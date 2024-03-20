import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import routing from "./routing.js";
import itemJson from "./items.json" assert { type: "json" };
import roomsConnections from "./roomsConnections.json" assert { type: "json" };

// @TODO : faire des modules plutot qu'un énorme JS
import db from "./db.js";

let gameID;

const maxUsersOnline = 6;

let activeUsers = new Map();

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

function generateRandomIndexForKey(rowCount) {
  var num = Math.floor(Math.random() * rowCount);
  return num === 8 || num === 15 ? generateRandomIndexForKey() : num;
}

let initializationRooms = async (gameID) => {
  let id = gameID;
  let myGame = await db("games").where("gameId", id).first();
  let myRooms = await db("rooms").where("gameId", id);
  let rowCount = myGame.rooms;
  let numberOfSafeRoom = 19;
  let keyItem = arrayOfItems[arrayOfItems.length - 1];
  if (myRooms == rowCount) {
    console.log("rooms has already initialized");
  } else {
    let randomIndexForKey = generateRandomIndexForKey(rowCount);
    for (let i = 0; i < rowCount; i++) {
      let randomIndex = Math.floor(
        Math.random() * (arrayOfItems.length - 1) // -1 pour ne pas avoir la key (qui est le dernier item du JSON)
      );
      let chosenItem = arrayOfItems[randomIndex];
      if (i == 0 || i == numberOfSafeRoom) chosenItem = null;
      if (i == randomIndexForKey) chosenItem = keyItem;
      try {
        // Insérez les salles dans la base de données
        await db.transaction(async (trx) => {
          await trx("rooms").insert({
            gameId: id,
            name: "room" + i,
            item: chosenItem,
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

  let updateRooms = async (playerRoom) => {
    let item = playerRoom.item;
    console.log("item : ", item);
    // item = JSON.parse(item); // convert string to json
    let user = await db("users").where("id", socket.data.userId).first();
    let inventory = user.inventory;
    console.log(!inventory ? "oui" : " non");
    if (inventory) inventory = inventory + "/" + item;
    if (!inventory) inventory = item;
    console.log("inventory : ", inventory);
    console.log(inventory.split("/"));

    await db("users")
      .where("id", socket.data.userId)
      .update("inventory", inventory);

    user = await db("users").where("id", socket.data.userId).first();

    reloadUsers();
    socket.emit("updateUser", user);
    await db("rooms")
      .where("gameId", playerRoom.gameId)
      .andWhere("name", playerRoom.name)
      .update("item", "null");
    let rooms = await db("rooms").where({ gameId: playerRoom.gameId });
    socket.emit("youAskedRooms", rooms);
  };

  socket.on("getMyUser", async (id) => {
    if (!id) return;
    let myUser = await db("users").where("id", id).first();
    socket.emit("ThisIsYourUser", myUser);
    if (!myUser) return;
    if (myUser.gameId) socket.data.gameId = myUser.gameId;
    if (myUser.id) socket.data.userId = myUser.id;
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
      await db("users").where("id", id).update({ room: 0 });
    }
    let indexAleatoire = Math.floor(Math.random() * activeUsersKeys.length);
    await db("users")
      .where("id", activeUsersKeys[indexAleatoire])
      .update({ team: "boss" })
      .update({ room: 38 });

    reloadUsers();
    updateGame(id);
  });

  socket.on("openGame", async (id) => {
    let activeUsersKeys = Array.from(activeUsers.keys());
    await db("games").where({ gameId: id }).update({ statut: "waiting" });

    for (const id of activeUsersKeys) {
      await db("users").where("id", id).update({ team: null });
      await db("users").where("id", id).update({ hero: null });
      await db("users").where("id", id).update({ atk: null });
      await db("users").where("id", id).update({ def: null });
    }

    reloadUsers();
    updateGame(id);
  });

  socket.on("startGame", async (id) => {
    await db("games").where({ gameId: id }).update({ statut: "started" });
    let activeUsersKeys = Array.from(activeUsers.keys());
    for (const [index, id] of activeUsersKeys.entries()) {
      let player = await db("users").where("id", id).first();
      let numberOfPlayer = "player" + (index + 1);
      await db("users").where("id", id).update({ player: numberOfPlayer });
      if (player.team == "boss") {
        await db("users").where("id", id).update({ player: "boss" });
      }
    }
    reloadUsers();
    updateGame(id);
  });

  // gestion de deconnection des users
  socket.on("disconnect", async () => {
    if (!socket.data.userId || !socket.data.gameId) return;
    console.log(
      `L'utilisateur avec l'ID ${socket.data.userId} s'est déconnecté`
    );

    // Supprime l'ID de socket de la map des utilisateurs connectés
    activeUsers.delete(socket.data.userId);
    await db("games")
      .where({ gameId: socket.data.gameId })
      .update({ users: activeUsers.size });

    // Met à jour le nombre d'utilisateurs connectés et émet à tous les clients
    await reloadUsers();
    io.emit("updateUsersCount", activeUsers.size);
  });

  socket.on("joinGame", async (id) => {
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
        await db("users")
          .where({ id: socket.data.userId })
          .update({ gameId: id });
        await db("inventory")
          .where({ id: socket.data.userId })
          .update({ gameId: id });
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
    if (!socket.data.userId && !socket.data.gameId) return;
    try {
      // Mettre à jour le champ 'hero' dans la table 'users'
      await db("users")
        .where({ id: socket.data.userId })
        .update({ heroImg: selectedhero.img });
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

  socket.on("getRooms", async (gameId) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    let rooms = await db("rooms").where({ gameId: gameId });
    socket.emit("youAskedRooms", rooms);
  });

  socket.on("askToChangeRoom", async (targetRoom) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    await db("users")
      .where({ id: socket.data.userId })
      .update({ room: targetRoom });
    await reloadUsers();
    io.emit("movePlayer", socket.data.userId);
  });

  socket.on("getItemInRoom", async (data) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    updateRooms(data);
  });
});

// Route pour récupérer et créer une nouvelle partie
app.post("/creategame", async (req, res) => {
  const { name } = req.body;

  try {
    // Vérifier si le nom de la partie existe déjà dans la base de données
    const existingGame = await db("games").where("name", name).first();
    if (existingGame) {
      console.log("La partie existe déjà");
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
