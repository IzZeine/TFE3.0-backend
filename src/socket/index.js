import db from "../../db.js";
import { io } from "../server.js";
import { createUser } from "../models/user.js";
import { updateUsers } from "./game.js";

//TODO: Remove updateUserCount event client side

const reloadUsers = () => {};
const updateGame = () => {};

io.on("connection", async (socket) => {
  let endGame = async (winner, gameId) => {
    await db("games").where({ gameId: gameId }).update({ statut: "ended" });

    let teamWinner = await db("users")
      .where({ gameId: gameId })
      .andWhere("team", winner);

    updateGame(gameId);
    io.emit("endGame", teamWinner);
  };

  //reloadUsers();

  socket.on("clearAllDataBase", async () => {
    await resetAllDataBase();
    await reloadUsers();
  });

  socket.on("playSound", (data) => {
    io.emit("playThisSound", data);
  });

  socket.on("getMyUser", async (id, callback) => {
    if (!id) return;
    const myUser = await db("users").where("id", id).first();
    callback(myUser);
  });

  socket.on("isActiveUsers", async (data) => {
    await reloadUsers();
  });

  // create a user
  socket.on("createUser", async (data, callback) => {
    const { gameId } = data;
    const user = createUser(data);
    socket.data.userId = user.id;
    socket.data.user = user;
    socket.join(gameId);
    console.log("Created user ID", user.id);
    updateUsers(gameId);
    callback(user);
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
      `L'utilisateur avec l'ID ${socket.data.userId} s'est déconnecté`,
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

  socket.on("askToChangeRoom", async (targetRoom, callback) => {
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

    callback({
      user: await db("users").where({ id: socket.data.userId }).first(),
    });
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
