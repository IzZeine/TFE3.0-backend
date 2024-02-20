import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import itemJson from "./items.json" assert { type: "json" };
import heroesJson from "./heroes.json" assert { type: "json" };

import db from "./db.js";

const sessionID = uuidv4();
// console.log(sessionID);
// initial 1
let gameStep = 1;
let activeUsers = new Map();
// initial 6
const maxUsersOnline = 4;
const minUsersOnline = 2;
let playersReady = new Map();
let currentGame = {
  started: false,
  numberOfRooms: 39,
  numberOfPlayers: 0,
};

let arrayOfItems = Object.values(itemJson); // passer le Json en array pour utiliser les index plus facilement

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  methods: ["GET", "POST"],
});

app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

app.use(function (req, res, next) {
  req.io = io;
  next();
});

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

// ?
app.post("/post", (req, res) => {
  console.log("receive", req.params.channel, req.body);
  req.io.emit("post", req.body);
  res.json({ status: "success" });
});

let initializationRooms = async () => {
  let rowCount = await db.select().from("rooms").count("* as allRooms");
  let verifCount = parseInt(rowCount[0].allRooms);
  if (verifCount > 0) {
    console.log("rooms has already initialized");
  } else {
    // console.log("creating rooms");
    for (let i = 0; i < currentGame.numberOfRooms; i++) {
      try {
        let indexAleatoire = Math.floor(Math.random() * arrayOfItems.length);
        // Insérez les salles dans la base de données
        await db.transaction(async (trx) => {
          await trx("rooms").insert({
            name: "room" + i,
            item: arrayOfItems[indexAleatoire],
          });
        });
        console.log("Les salles ont été insérées avec succès.");
      } catch (error) {
        console.error("Erreur lors de l'insertion des salles :", error);
      }
    }
  }
};
initializationRooms();

io.on("connection", async (socket) => {
  io.emit("gameStep", gameStep);
  io.emit("updateUsersCount", activeUsers.size);

  let userID;

  // mettre une promesse pour que le script attende l'ID (sinon je galère trop sa mère)
  socket.on("MyID", async (id) => {
    userID = id;
    activeUsers.set(userID, true);
    io.emit("updateUsersCount", activeUsers.size);
    console.log(activeUsers);
    const roomForSocket = await getRoomForSocket(userID);
    console.log("Room pour le socket", userID, ":", roomForSocket);
    // socket.emit("yourRoom", roomForSocket)
  });

  // à voir ...
  function getRoomForSocket(socketId) {
    const userId = activeUsers.get(socketId);

    if (!userId) {
      console.log("ID d'utilisateur non trouvé pour le socket:", socketId);
      return null;
    }

    // Utilisez l'ID d'utilisateur pour récupérer la "room" correspondante dans la base de données
    return db("users")
      .where("ID", userId)
      .select("room")
      .first()
      .then((user) => {
        if (user) {
          return user.room;
        } else {
          console.log(
            "Utilisateur non trouvé dans la base de données pour le socket:",
            socketId
          );
          return null;
        }
      })
      .catch((error) => {
        console.error(
          'Erreur lors de la récupération de la "room" pour le socket:',
          error
        );
        return null;
      });
  }

  //@TODO : bloquer l'accès au nouveaux joueurs
  if (currentGame.started == true) {
    // c'est le plateau qui ouvre et qui ferme la partie? c'est là qu'on scan le QR code pour se connecter
  }

  socket.on("wantToDoSomething", () => {
    socket.emit("wait");
    playersReady.set(userID, true);
    if (playersReady.size === activeUsers.size) {
      gameStep++;
      console.log(gameStep);
      socket.emit("gameStep", gameStep);
      playersReady.clear();
    }
  });

  if (activeUsers.size == maxUsersOnline) {
    socket.emit("deco", userID);
    // socket.disconnect;
    console.log("deco");
  }

  // create a user
  socket.on("createUser", async (userData) => {
    let { username } = userData;
    userID = uuidv4(); // Générer un nouvel identifiant UUID
    try {
      // Insérer les données dans la table 'utilisateurs'
      await db.transaction(async (trx) => {
        await trx("users").insert({
          id: userID,
          username,
          inventory_id: userID, // Utiliser le même ID pour l'inventaire
          room: "0",
        });
        await trx("inventory").insert({
          id: userID, // Utiliser le même ID pour l'inventaire
          user_id: userID, // Utiliser le même ID pour l'utilisateur
        });
      });

      // Récupérer la liste mise à jour des utilisateurs
      const users = await db.select().from("users");
      // Récupérer la liste mise à jour des inventaires
      const inventories = await db.select().from("inventory");

      // Envoyer l'ID unique généré au client
      socket.emit("userCreated", { userID });
    } catch (error) {
      console.error("Erreur lors de la création du compte :", error);
      // Gérer l'erreur ici
    }
  });

  // add a hero's type to the db
  socket.on("selectedHero", async (selectedhero) => {
    console.log(selectedhero);
    console.log(userID);
    try {
      // Mettre à jour le champ 'hero' dans la table 'users'
      await db("users").where({ id: userID }).update({ hero: selectedhero });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du héros :", error);
      // Gérer l'erreur ici
    }
  });

  // gestion de deconnection des users
  socket.on("disconnect", () => {
    console.log(`L'utilisateur avec l'ID ${userID} s'est déconnecté`);

    // Supprime l'ID de socket de la map des utilisateurs connectés
    activeUsers.delete(userID);

    // Met à jour le nombre d'utilisateurs connectés et émet à tous les clients
    io.emit("updateUsersCount", activeUsers.size);
  });
});

// Route pour récupérer des données depuis la base de données Users
app.get("/users", async (req, res) => {
  try {
    const users = await db.select().from("users");
    res.json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur serveur");
  }
});

// Route pour récupérer des données depuis la base de données Users
app.get("/inventories", async (req, res) => {
  try {
    const inventories = await db.select().from("inventory");
    res.json(inventories);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur serveur");
  }
});

app.get("/items", async (req, res) => {
  const items = await itemJson;
  res.json(items);
});
app.get("/heroes", async (req, res) => {
  const heroes = await heroesJson;
  res.json(heroes);
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
