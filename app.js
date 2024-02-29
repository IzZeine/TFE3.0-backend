import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import routing from "./routing.js";
import itemJson from "./items.json" assert { type: "json" };

import db from "./db.js";

let gameID;
let gameStep = 1;
const maxUsersOnline = 6;
const minUsersOnline = 2;
let activeUsers = new Map();
let playersReady = new Map();

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

routing(app);

let initializationRooms = async (gameID) => {
  let id = gameID;
  let myGame = await db("games").where("gameId", id).first();
  let rowCount = myGame.rooms;
  let myRooms = await db("rooms").where("gameId", id);
  console.log(myRooms.length);
  if (myRooms == rowCount) {
    console.log("rooms has already initialized");
  } else {
    for (let i = 0; i < rowCount; i++) {
      try {
        let indexAleatoire = Math.floor(Math.random() * arrayOfItems.length);
        // Insérez les salles dans la base de données
        await db.transaction(async (trx) => {
          await trx("rooms").insert({
            gameId: id,
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

io.on("connection", async (socket) => {
  io.emit("gameStep", gameStep);
  io.emit("updateUsersCount", activeUsers.size);

  // create a user
  socket.on("createUser", async (data) => {
    console.log(data);
    let name = data;
    let userID = uuidv4(); // Générer un nouvel identifiant UUID
    try {
      // Insérer les données dans la table 'utilisateurs'
      await db.transaction(async (trx) => {
        await trx("users").insert({
          id: userID,
          username: name,
          inventory_id: userID, // Utiliser le même ID pour l'inventaire
          ready: false,
          room: "0",
        });
        await trx("inventory").insert({
          id: userID, // Utiliser le même ID pour l'inventaire
          user_id: userID, // Utiliser le même ID pour l'utilisateur
        });
      });

      // Envoyer l'ID unique généré au client
      socket.emit("userCreated", userID);
    } catch (error) {
      console.error("Erreur lors de la création du compte :", error);
      // Gérer l'erreur ici
    }
  });

  let userIDPromise = new Promise((resolve, reject) => {
    socket.on("getMyUser", async (id) => {
      // resolve(id); // Résoudre la promesse avec l'ID utilisateur

      let myUser = await db("users").where("id", id).first();
      resolve(myUser);
      socket.emit("ThisIsYourUser", myUser);
    });
  });

  const user = await userIDPromise;

  // gestion de deconnection des users
  socket.on("disconnect", async () => {
    if (user) {
      console.log(`L'utilisateur avec l'ID ${user.id} s'est déconnecté`);

      // Supprime l'ID de socket de la map des utilisateurs connectés
      activeUsers.delete(user.id);
      await db("games")
        .where({ gameId: user.gameId })
        .update({ users: activeUsers.size });

      // Met à jour le nombre d'utilisateurs connectés et émet à tous les clients
      io.emit("updateUsersCount", activeUsers.size);
    }
  });

  socket.on("joinGame", async (id) => {
    try {
      socket.join(id);
      let usersInGame = await db("games").where({ gameId: id }).first();
      if (usersInGame.size >= maxUsersOnline) {
        socket.emit("deco", user.id);
        // socket.disconnect;
        console.log("deco");
      } else {
        // ajuster le bon nbre de joueurs à la game
        activeUsers.set(user.id, true);
        activeUsers.delete(null);
        await db("users").where({ id: user.id }).update({ gameId: id });
        await db("inventory").where({ id: user.id }).update({ gameId: id });
        await db("games")
          .where({ gameId: id })
          .update({ users: activeUsers.size });
        // Met à jour le nombre d'utilisateurs connectés et émet à tous les clients
        io.emit("updateUsersCount", activeUsers.size);
        console.log(activeUsers);
      }
    } catch (error) {
      console.error("Erreur lors de connaction à la partie :", error);
      // Gérer l'erreur ici
    }
  });

  socket.on("wantToDoSomething", () => {
    socket.emit("wait");
    playersReady.set(user.id, true);
    if (playersReady.size === activeUsers.size) {
      gameStep++;
      console.log(gameStep);
      socket.emit("gameStep", gameStep);
      playersReady.clear();
    }
  });

  // add a hero's type to the db
  socket.on("selectedHero", async (selectedhero) => {
    try {
      // Mettre à jour le champ 'hero' dans la table 'users'
      await db("users").where({ id: user.id }).update({ hero: selectedhero });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du héros :", error);
      // Gérer l'erreur ici
    }
    socket.emit("registeredHero");
  });
});

//@TODO : comment gérer les diff games ? empêcher les joueurs de se connecter quand le game est lancée ou pleine et changer les infos de game durant la partie. Est-ce que ça doit être lié avec le socket ? je ne pense pas. Comment faire alors ?

//@TODO : ou gérer la direction des salles? quelle salle peut aller ou ? gérer le déplacement des joueurs et afficher les bonnes sorties en fonction

// Route pour récupérer et créer une nouvelle partie
app.post("/creategame", async (req, res) => {
  const { name } = req.body;

  try {
    // Vérifier si le nom de la partie existe déjà dans la base de données
    const existingGame = await db("games").where("name", name).first();
    if (existingGame) {
      console.log("NON");
      return res
        .status(400)
        .json({ success: false, error: "Game name already exists" });
    } else {
      // initialisé la partie
      gameID = uuidv4(); // définir l'ID unique de la game à max 6 joueurs
      gameStep = 1; // définir l'état de la partie
      // Insérer les données dans la table 'games'
      await db.transaction(async (trx) => {
        await trx("games").insert({
          gameId: gameID,
          name: name,
          statut: "waiting",
          started: false,
          step: 1,
          rooms: 39,
          users: 0,
        });
      });
      //@TODO : ajouter l'id de la game aux users qui la rejoignent

      initializationRooms(gameID);

      // Récupérer la liste mise à jour des games
      const game = await db("games").where("gameId", gameID).first();
      res.json(game);
    }
  } catch (error) {
    console.error("Erreur lors de la création de la partie :", error);
    // Gérer l'erreur ici
  }
});

// Route pour récupérer les games active
app.get("/activegames", async (req, res) => {
  const activeGames = await db("games").where("statut", "waiting");
  res.json(activeGames);
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
