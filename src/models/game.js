import db from "../../db.js";
import { seedGameRooms } from "./rooms.js";
import { nanoid } from "nanoid";

//Ces fonctions doivent être agnostiques du contexte dans lequel elles sont appelées. Elle ne s'occupent que de faire des modifications sur la DB

export const getAllGames = async (name) => {
  const rawGames = await db.select().from("games");
  return Promise.all(
    rawGames.map(async (game) => {
      const users = await db("users").where({ gameId: game.gameId });
      return { ...game, users };
    })
  );
};

export const createGame = async (name) => {
  const gameId = nanoid(); // définir l'ID unique de la game à max 6 joueurs
  // Insérer les données dans la table 'games'
  const id = await db("games").insert({
    gameId,
    name: name,
    statut: "waiting",
    rooms: 39,
    users: 0,
    round: 1,
    turn: "hero",
  });
  const game = await db("games").where({ gameId }).first();
  const rooms = await seedGameRooms(game);
  console.log("createdGame", game);
  return { ...game, rooms };
};

export const closeGame = async (gameId) => {
  console.log("closeGame", gameId);
  await db("games").where({ gameId }).update({ statut: "closed" });
  const users = await db("users").where({ gameId });
  const randomIndex = Math.floor(Math.random() * users.length);
  await db.transaction(async (trx) => {
    return Promise.all(
      users.map((user, index) => {
        if (index === randomIndex) {
          return trx("users")
            .where({ id: user.id })
            .update({ team: "boss", room: 38, pa: 3, yourTurn: false });
        }
        return trx("users")
          .where({ id: user.id })
          .update({ team: "hero", room: 0, pa: 3, yourTurn: false });
      })
    );
  });
};

export const openGame = async (gameId) => {
  console.log("openGame", gameId);
  await db("games").where({ gameId }).update({ statut: "waiting" });
  const users = await db("users").where({ gameId });
  await db.transaction(async (trx) => {
    return Promise.all(
      users.map((user, index) => {
        return trx("users")
          .where({ id: user.id })
          .update({ team: null, hero: null, atk: null, def: null });
      })
    );
  });
};
