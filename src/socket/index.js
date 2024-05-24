import db from "../../db.js";
import { io } from "../server.js";
import { createUser } from "../models/user.js";
import { updateGame, updateUsers } from "./game.js";
import { closeGame, openGame } from "../models/game.js";

//TODO: Remove updateUserCount event client side

io.on("connection", async (socket) => {
  let endGame = async (winner, gameId) => {
    await db("games").where({ gameId: gameId }).update({ statut: "ended" });

    let teamWinner = await db("users")
      .where({ gameId: gameId })
      .andWhere("team", winner);

    updateGame(gameId);
    io.emit("endGame", teamWinner);
  };

  //updateUsers();

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
    /*
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
    */
    const user = await db("users").where({ id: socket.data.userId }).first();
    await updateUsers(user.gameId);
    callback({
      user,
    });
  });

  socket.on("getItemInRoom", async (data) => {
    if (!socket.data.userId && !socket.data.gameId) return;
    updateRooms(data);
    updateUsers();
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
    updateUsers();
    io.emit("saveYou", user.id);
  });

  socket.on("healUser", async (user) => {
    let targetLife = user.life + 1;
    await db("users").where({ id: user.id }).update({ life: targetLife });
    updateUsers();
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

    updateUsers();
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
