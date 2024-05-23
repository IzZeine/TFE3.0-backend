import db from "../db.js";
import { io } from "./server.js";
import { seedGameRooms } from "./rooms.js";
import { nanoid } from "nanoid";

export const createGame = async (name) => {
  const gameId = nanoid(); // définir l'ID unique de la game à max 6 joueurs
  // Insérer les données dans la table 'games'
  const id = await db("games").insert({
    gameId,
    name: name,
    statut: "waiting",
    rooms: 39,
    users: 0,
  });
  const game = await db("games").where({ gameId }).first();
  const rooms = await seedGameRooms(game);
  console.log("createdGame", game);
  return { ...game, rooms };
};
