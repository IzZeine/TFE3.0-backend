import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import routing from "./routing.js";
// @TODO : faire un JSON des boss
import itemJson from "./items.json" assert { type: "json" };

// @TODO : faire des modules plutot qu'un énorme JS
import db from "./db.js";

let gameID;

// @TODO : pas const
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
  // @TODO : faire la migration des directions possible de chaque salle
  let id = gameID;
  let myGame = await db("games").where("gameId", id).first();
  let rowCount = myGame.rooms;
  let myRooms = await db("rooms").where("gameId", id);
  // @TODO : faire un json avec le bon nombre d'item et une seul clef
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
  io.emit("updateUsersCount", activeUsers.size);

  let reloadUsers = async () => {
    console.log(activeUsers)
    let users = [];
    let activeUsersKeys = Array.from(activeUsers.keys());

    for (const id of activeUsersKeys) {
      let user = await db("users").where("id", id).first();
      users.push(user);
    }

    io.emit("updateUsers", users);
  };

  let updateGame = async (id) => {
    let game = await db("games").where("gameId", id).first();
    io.emit("updateGame", game);
  };

  socket.on("getMyUser", async (id) => {
    console.log("userID", id)
    if(!id) return
    let myUser = await db("users").where("id", id).first();
    if (myUser.gameId) socket.data.gameId = myUser.gameId;
    if (myUser.id) socket.data.userId = myUser.id;
    socket.emit("ThisIsYourUser", myUser);
  });

  socket.on("isActiveUsers", async (data) => {
    await reloadUsers();
  });

  // create a user
  socket.on("createUser", async (data) => {
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
          life: 3,
        });
        await trx("inventory").insert({
          id: userID, // Utiliser le même ID pour l'inventaire
          user_id: userID, // Utiliser le même ID pour l'utilisateur
        });
      });

      socket.data.userId = userID;

      // Envoyer l'ID unique généré au client
      socket.emit("userCreated", userID);
    } catch (error) {
      console.error("Erreur lors de la création du compte :", error);
      // Gérer l'erreur ici
    }
  });

  socket.on("closeGame", async (id) => {
    await db("games").where({ gameId: id }).update({ statut: "closed" });
    let activeUsersKeys = Array.from(activeUsers.keys());
    for (const id of activeUsersKeys) {
      await db("users").where("id", id).update({ team: "hero" });
    }
    let indexAleatoire = Math.floor(Math.random() * activeUsersKeys.length);
    await db("users")
      .where("id", activeUsersKeys[indexAleatoire])
      .update({ team: "boss" });

    reloadUsers();
    updateGame(id);
  });

  socket.on("openGame", async (id) => {
    await db("games").where({ gameId: id }).update({ statut: "waiting" });
    reloadUsers();
    updateGame(id);
  });

  socket.on("startGame", async (id) => {
    await db("games").where({ gameId: id }).update({ statut: "started" });
    reloadUsers();
    updateGame(id);
  });

  // const user = await userIDPromise;

  // gestion de deconnection des users
  socket.on("disconnect", async () => {
      if(!socket.data.userId && !socket.data.gameId) return;
      console.log(`L'utilisateur avec l'ID ${socket.data.userId} s'est déconnecté`);

      // Supprime l'ID de socket de la map des utilisateurs connectés
      activeUsers.delete(socket.data.userId);
      await db("games")
        .where({ gameId: socket.data.gameId })
        .update({ users: activeUsers.size });

      // Met à jour le nombre d'utilisateurs connectés et émet à tous les clients
      // @TODO : envoyer la liste à jour des users
      io.emit("updateUsersCount", activeUsers.size);
      await reloadUsers();
  });

  // @TODO : quand la partie se lance faire un nbre aléatoire et l'index des users pour choisir le méchant
  // @TODO : le boss commence à une autre room : 39

  socket.on("joinGame", async (id) => {
    console.log("mySocket", socket.data.userId)
    if (!socket.data.userId) return;
    try {
      socket.join(id);
      let game = await db("games").where({ gameId: id }).first();
      if (game.users >= maxUsersOnline || game.statut == "sarted") {
        socket.emit("deco", socket.data.userId);
        // socket.disconnect;
        console.log("deco");
      } else {
        // ajuster le bon nbre de joueurs à la game
        activeUsers.set(socket.data.userId, true);
        activeUsers.delete(null);
        await db("users").where({ id: socket.data.userId }).update({ gameId: id });
        await db("inventory").where({ id: socket.data.userId }).update({ gameId: id });
        await db("games")
          .where({ gameId: id })
          .update({ users: activeUsers.size });
        // Met à jour le nombre d'utilisateurs connectés et émet à tous les clients
        io.emit("updateUsersCount", activeUsers.size);
        await reloadUsers();
      }
    } catch (error) {
      console.error("Erreur lors de connaction à la partie :", error);
      // Gérer l'erreur ici
    }
  });

  if (socket.data.userId) {
    if (socket.data.gameId) {
      activeUsers.set(user.id, true);
    }
  }

  // add a hero's type to the db
  socket.on("selectedHero", async (selectedhero) => {
    if(!socket.data.userId && !socket.data.gameId) return;
    try {
      // Mettre à jour le champ 'hero' dans la table 'users'
      await db("users")
        .where({ id: socket.data.userId })
        .update({ hero: selectedhero.name });
      await db("users")
        .where({ id: socket.data.userId })
        .update({ atk: selectedhero.baseAtk });
      await db("users")
        .where({ id: socket.data.userId })
        .update({ def: selectedhero.baseLife });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du héros :", error);
      // Gérer l'erreur ici
    }
    socket.emit("registeredHero");
    await reloadUsers();
  });
});

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
      // Insérer les données dans la table 'games'
      await db.transaction(async (trx) => {
        await trx("games").insert({
          gameId: gameID,
          name: name,
          statut: "waiting",
          rooms: 39,
          users: 0,
        });
      });

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
