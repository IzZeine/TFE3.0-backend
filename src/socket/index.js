import db from "../../db.js";
import { io } from "../server.js";
import { createUser } from "../models/user.js";
import { returnAtSpawn, updateGame, updateGames, updateUsers } from "./game.js";
import { closeGame, openGame } from "../models/game.js";
import { updateRooms } from "../models/rooms.js";
import {
  powerDruide,
  powerGolem,
  powerKnight,
  powerNecromancer,
  powerRodeur,
  powerSnake,
  powerWizard,
  usePower,
} from "./powers.js";

//TODO: Remove updateUserCount event client side

io.on("connection", async (socket) => {
  let endGame = async (winner, gameId) => {
    await db("games").where({ gameId: gameId }).update({ statut: "ended" });

    let teamWinner = await db("users")
      .where({ gameId: gameId })
      .andWhere("team", winner);

    await updateGame(gameId);
    io.emit("endGame", teamWinner);
  };

  socket.on("clearAllDataBase", async () => {
    await resetAllDataBase();
    await updateUsers();
  });

  socket.on("playSound", (data) => {
    io.emit("playThisSound", data);
  });

  socket.on("getMyUser", async (id, callback) => {
    if (!id) return;
    const myUser = await db("users").where("id", id).first();
    socket.data.userId = myUser.id;
    socket.data.gameId = myUser.gameId;
    socket.data.user = myUser;
    callback(myUser);
  });

  socket.on("joinGame", async (gameId) => {
    socket.join(gameId);
    console.log("board joined", gameId);
  });

  socket.on("isActiveUsers", async (data) => {
    await updateUsers();
  });

  // create a user
  socket.on("createUser", async (data, callback) => {
    const { gameId } = data;
    const user = await createUser(data);
    socket.data.userId = user.id;
    socket.data.gameId = user.gameId;
    socket.data.user = user;
    socket.join(gameId);
    console.log("Created user ID", user.id);
    await updateGame(gameId);
    callback(user);
  });

  socket.on("closeGame", async (id) => {
    await closeGame(id);
    await updateGame(id);
  });

  socket.on("openGame", async (id) => {
    await openGame(id);
    await updateGame(id);
  });

  socket.on("startGame", async (id) => {
    await db("games").where({ gameId: id }).update({ statut: "started" });
    await updateGame(id);
  });

  // gestion de deconnection des users
  socket.on("disconnect", async () => {
    if (!socket.data.userId || !socket.data.gameId) return;

    console.log(
      `L'utilisateur avec l'ID ${socket.data.userId} s'est déconnecté`
    );
  });

  // add a hero's type to the db
  socket.on("selectedHero", async (selectedhero) => {
    if (!socket.data.user?.gameId) return;
    let user = socket.data.user;
    try {
      // Mettre à jour le champ 'hero' dans la table 'users'
      await db("users").where({ id: user.id }).update({
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
    await updateUsers(user.gameId);
    await updateGame(user.gameId);
  });

  socket.on("getRooms", async (gameId) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    let rooms = await db("rooms").where({ gameId: gameId });
    socket.emit("youAskedRooms", rooms);
  });

  socket.on("askToChangeRoom", async (targetRoom, callback) => {
    if (!socket.data.userId && !socket.data.gameId) return;

    await db("users")
      .where({ id: socket.data.userId })
      .update({ room: targetRoom });

    const user = await db("users").where({ id: socket.data.userId }).first();
    await updateUsers(user.gameId);
    await updateGame(user.gameId);
    callback({
      user,
    });
  });

  socket.on("getItemInRoom", async (data) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    const rooms = await updateRooms(data, socket);
    await updateUsers(socket.data.gameId);
    await updateGame(socket.data.gameId);
    io.to(socket.data.gameId).emit("itemWasTaken", data);
    io.to(socket.data.gameId).emit("youAskedRooms", rooms);
  });

  socket.on("usePower", async (data) => {
    const { user, target, timestamp } = data;
    io.to(user.gameId).emit("usedPower", { user, target });
    await usePower(user, socket);
    switch (user.hero) {
      case "Rodeur":
        await powerRodeur(user, target, socket);
        break;
      case "Chevalier":
        await powerKnight(user, socket);
        break;
      case "Necromancien":
        await powerNecromancer(target, socket);
        break;
      case "Druide":
        await powerDruide(target, socket);
        break;
      case "Magicien":
        await powerWizard(user, socket);
        break;
      case "Serpent":
        await powerSnake(user, socket);
        break;
      default:
        console.log("nobody");
    }
    await updateUsers(user.gameId);
    await updateGame(user.gameId);
  });

  socket.on("dropARock", async () => {
    if (!socket.data.userId && !socket.data.gameId) return;
    await powerGolem(socket);
    await updateUsers(socket.data.gameId);
    await updateGame(socket.data.gameId);
  });

  socket.on("battle", async (data, callback) => {
    let winner;
    let room = data[0].room;
    let gameId = data[0].gameId;
    io.to(gameId).emit("battle", room);

    let boss = data.filter((user) => user.team == "boss");
    let heroes = data.filter((user) => user.team == "hero");

    let bossLife = boss[0].def;
    let totalHeroesAtk = heroes.reduce((total, hero) => total + hero.atk, 0);

    if (bossLife > totalHeroesAtk) {
      let min = (a, f) => a.reduce((m, x) => (m[f] < x[f] ? m : x));
      let weakestHero = min(heroes, "def");

      await db("users")
        .where("id", weakestHero.id)
        .update("life", weakestHero.life - 1);

      console.log(weakestHero.username);
      await returnAtSpawn(gameId, room);
      await updateUsers(gameId);
      await updateGame(gameId);
      winner = [...boss];
    }

    if (bossLife < totalHeroesAtk) {
      await returnAtSpawn(gameId, room);
      await updateUsers(gameId);
      await updateGame(gameId);
      winner = [...heroes];
    }

    if (bossLife == totalHeroesAtk) {
      await returnAtSpawn(gameId, room);
      await updateUsers(gameId);
      await updateGame(gameId);
      winner = null;
    }

    callback(winner);
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
      updateUsers();
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

    updateUsers();
  });
});
