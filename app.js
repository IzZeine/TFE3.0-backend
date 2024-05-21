import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import routing from "./routing.js";
import itemJson from "./items.json" assert { type: "json" };

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

async function resetAllDataBase() {
  await db("users").truncate();
  await db("games").truncate();
  await db("rooms").truncate();
}

async function resetGameDataBase(id) {
  console.log("done");
  // @TODO
}

async function resetPlayerDataBase(id) {
  console.log("done");
  // @TODO
}

function generateRandomIndexForKey(rowCount) {
  var num = Math.floor(Math.random() * rowCount);
  return num === 0 || num === 19 ? generateRandomIndexForKey() : num;
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
      } catch (error) {
        console.error("Erreur lors de l'insertion des salles :", error);
      }
    }
  }
};

io.on("connection", async (socket) => {
  io.emit("updateUsersCount", activeUsers.size);

  let updateGame = async (id) => {
    let game = await db("games").where("gameId", id).first();
    io.emit("updateGame", game);
  };

  let updateRooms = async (playerRoom) => {
    let item = playerRoom.item;
    let itemJson = JSON.parse(item);
    let user = await db("users").where("id", socket.data.userId).first();
    let userDef = user.def;
    let userAtk = user.atk;
    let inventory = user.inventory;
    if (inventory) inventory = inventory + "/" + item;
    if (!inventory) inventory = item;

    if (itemJson.type == "def") userDef = userDef + Number(itemJson.bonus);
    if (itemJson.type == "atk") userAtk = userAtk + Number(itemJson.bonus);

    await db("users").where("id", socket.data.userId).update({
      inventory: inventory,
      def: userDef,
      atk: userAtk,
    });

    user = await db("users").where("id", socket.data.userId).first();

    reloadUsers();
    socket.emit("updateUser", user);
    await db("rooms")
      .where("gameId", playerRoom.gameId)
      .andWhere("name", playerRoom.name)
      .update("item", "");
    let rooms = await db("rooms").where({ gameId: playerRoom.gameId });
    io.emit("youAskedRooms", rooms);
  };

  let endGame = async (winner, gameId) => {
    await db("games").where({ gameId: gameId }).update({ statut: "ended" });

    let teamWinner = await db("users")
      .where({ gameId: gameId })
      .andWhere("team", winner);

    updateGame(gameId);
    io.emit("endGame", teamWinner);
  };

  let reloadUsers = async () => {
    let users = [];
    let activeUsersKeys = Array.from(activeUsers.keys());

    for (const id of activeUsersKeys) {
      let user = await db("users").where("id", id).first();
      users.push(user);
    }

    io.emit("updateUsers", users);
  };

  reloadUsers();

  socket.on("clearAllDataBase", async () => {
    await resetAllDataBase();
    await reloadUsers();
  });

  socket.on("playSound", (data) => {
    io.emit("playThisSound", data);
  });

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
  socket.on("createUser", async (data, callback) => {
    let name = data;
    let userID = uuidv4(); // Générer un nouvel identifiant UUID
    try {
      // Insérer les données dans la table 'utilisateurs'
      await db.transaction(async (trx) => {
        await trx("users").insert({
          id: userID,
          username: name,
          room: "0",
          life: 3,
        });
      });

      socket.data.userId = userID;

      // Envoyer l'ID unique généré au client
      socket.emit("userCreated", userID);
      callback(userID);
    } catch (error) {
      console.error("Erreur lors de la création du compte :", error);
      // Gérer l'erreur ici
    }
  });

  socket.on("closeGame", async (id) => {
    await db("games").where({ gameId: id }).update({ statut: "closed" });
    let activeUsersKeys = Array.from(activeUsers.keys());
    for (const id of activeUsersKeys) {
      await db("users").where("id", id).update({ team: "hero", room: 0 });
    }
    let indexAleatoire = Math.floor(Math.random() * activeUsersKeys.length);
    await db("users")
      .where("id", activeUsersKeys[indexAleatoire])
      .update({ team: "boss", room: 38 });

    reloadUsers();
    updateGame(id);
  });

  socket.on("openGame", async (id) => {
    let activeUsersKeys = Array.from(activeUsers.keys());
    await db("games").where({ gameId: id }).update({ statut: "waiting" });

    for (const id of activeUsersKeys) {
      await db("users")
        .where("id", id)
        .update({ team: null, hero: null, atk: null, def: null });
    }

    reloadUsers();
    updateGame(id);
  });

  socket.on("startGame", async (id) => {
    await db("games").where({ gameId: id }).update({ statut: "started" });
    let activeUsersKeys = Array.from(activeUsers.keys());
    let num = 1;
    for (const [index, id] of activeUsersKeys.entries()) {
      let player = await db("users").where("id", id).first();
      if (player.team == "boss") {
        await db("users").where("id", id).update({ player: "boss" });
        continue;
      }
      let numberOfPlayer = "player" + num;
      await db("users").where("id", id).update({ player: numberOfPlayer });
      num++;
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

    await db("users")
      .where({ id: socket.data.userId })
      .update({ gameId: null });
    // Met à jour le nombre d'utilisateurs connectés et émet à tous les clients
    await reloadUsers();
    io.emit("updateUsersCount", activeUsers.size);
  });

  socket.on("joinGame", async (id) => {
    if (!socket.data.userId) return;
    try {
      socket.join(id);
      let game = await db("games").where({ gameId: id }).first();
      if (game.users > maxUsersOnline) {
        // socket.emit("deco", socket.data.userId);
        // socket.disconnect;
        // console.log("deco");
      } else {
        // ajuster le bon nbre de joueurs à la game
        activeUsers.set(socket.data.userId, true);
        activeUsers.delete(null);
        await db("users")
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
      await db("users").where({ id: socket.data.userId }).update({
        heroImg: selectedhero.img,
        hero: selectedhero.name,
        atk: selectedhero.baseAtk,
        def: selectedhero.baseLife,
        color: selectedhero.color,
        abilityName: selectedhero.abilityName,
        ability: selectedhero.ability,
      });
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

    let boss = await db("users")
      .where("gameId", socket.data.gameId)
      .andWhere("team", "boss")
      .first();

    let heroes = await db("users")
      .whereNot("team", "boss")
      .andWhere("gameId", socket.data.gameId)
      .andWhere("room", boss.room);

    if (heroes.length > 0) {
      console.log("battle");
      io.emit("battle", { heroes: heroes, boss: boss, room: targetRoom });
      return;
    }

    socket.emit("movePlayer", socket.data.userId);
  });

  socket.on("getItemInRoom", async (data) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    updateRooms(data);
    reloadUsers();
    io.emit("takeItemInRoom", data.name);
  });

  socket.on("useAbility", async (data) => {
    let user = await db("users").where({ id: socket.data.userId }).first();
    let id = user.id;
    let hero = user.hero;
    if (data.id) id = data.id;
    io.emit("usedPower", id, hero);
  });

  socket.on("saveUser", async (user) => {
    await db("users").where({ id: user.id }).update({ life: 3 });
    reloadUsers();
    io.emit("saveYou", user.id);
  });

  socket.on("healUser", async (user) => {
    let targetLife = user.life + 1;
    await db("users").where({ id: user.id }).update({ life: targetLife });
    reloadUsers();
  });

  socket.on("nerfDices", () => {
    io.emit("isNerfingDices");
  });
  socket.on("undoNerfDices", () => {
    io.emit("undoNerfingDices");
  });

  socket.on("dropARock", async (rock) => {
    if (rock.def == 0) return;
    if (rock.def == 5) rock.nameId = "rock";
    if (rock.def == 10) rock.nameId = "rockRare";
    if (rock.def == 15) rock.nameId = "rockLegendary";

    let rockString = rock;
    rockString.def = rockString.def.toString();
    rockString = JSON.stringify(rockString);

    let boss = await db("users")
      .where("team", "boss")
      .andWhere("gameId", socket.data.gameId)
      .first();

    let inventory = boss.inventory;
    if (inventory) inventory = inventory + "/" + rockString;
    if (!inventory) inventory = rockString;

    await db("users")
      .where("team", "boss")
      .andWhere("gameId", socket.data.gameId)
      .update({ inventory: inventory, def: boss.def + parseInt(rock.def) });

    io.emit("takeItemInRoom", "room" + boss.room, boss);

    reloadUsers();
  });

  socket.on("battleEnded", async (data) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    let winner = data;

    if (Array.isArray(data)) {
      winner = "hero";
      endGame(winner, socket.data.gameId);
      return;
    }

    if (typeof data === "number") {
      await db("users")
        .whereNot("team", "boss")
        .andWhere("gameId", socket.data.gameId)
        .andWhere("room", data)
        .update("room", 0);

      await db("users")
        .where("team", "boss")
        .andWhere("gameId", socket.data.gameId)
        .andWhere("room", data)
        .update("room", 38);

      io.emit("returnAtSpawn", winner);
      reloadUsers();
      return;
    }

    console.log(data);

    let heroes = await db("users")
      .whereNot("team", "boss")
      .andWhere("gameId", socket.data.gameId)
      .andWhere("room", data.room);

    console.log(heroes);

    if (heroes.length < 1) return;

    let min = (a, f) => a.reduce((m, x) => (m[f] < x[f] ? m : x));

    let weakestHero = min(heroes, "def");

    await db("users")
      .where("id", weakestHero.id)
      .update("life", weakestHero.life - 1);
    if (weakestHero.life <= 0) console.log("t'es mort");

    let allHeroes = await db("users")
      .whereNot("team", "boss")
      .andWhere("gameId", socket.data.gameId);

    let heroesDead = allHeroes.every((hero) => hero.life <= 0);
    console.log(heroesDead);

    if (heroesDead) {
      await endGame("boss", socket.data.gameId);
      return;
    }

    await db("users")
      .whereNot("team", "boss")
      .andWhere("gameId", socket.data.gameId)
      .andWhere("room", data.room)
      .update("room", 0);

    await db("users")
      .where("team", "boss")
      .andWhere("gameId", socket.data.gameId)
      .andWhere("room", data.room)
      .update("room", 38);

    io.emit("returnAtSpawn", winner);

    reloadUsers();
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

server.listen(process.env.PORT, () => {
  console.log(`server running at http://localhost:${process.env.PORT}`);
});
