import db from "../../db.js";
import { io } from "../server.js";
import { getAllGames } from "../models/game.js";
import { clearGameDataBase } from "../models/clear.js";

//Mettre ici les appels que tu utilises tout le temps qui ne sont pas en rapport avec le socket.
export const updateGame = async (gameId) => {
  console.log("updateGame", gameId);
  const game = await db("games").where({ gameId }).first();
  const users = await db("users").where({ gameId });
  io.to(gameId).emit("updateGame", { ...game, users });
};

export const updateGames = async () => {
  console.log("updateGames");
  const games = await getAllGames();
  io.emit("updateGames", games);
};

export const updateUsers = async (gameId) => {
  console.log("updateUsers", gameId);
  const users = await db("users").where({ gameId });

  io.to(gameId).emit("updateUsers", users);
};

export const returnAtSpawn = async (gameId, room) => {
  console.log("return at spawn");
  await db("users")
    .whereNot("team", "boss")
    .andWhere("gameId", gameId)
    .andWhere("room", room)
    .update("room", 0);

  await db("users")
    .where("team", "boss")
    .andWhere("gameId", gameId)
    .andWhere("room", room)
    .update("room", 38);
};

export const endGame = async (gameId, winner) => {
  await db("games")
    .where({ gameId })
    .update({ statut: "ended", winner: winner });
  await updateGame(gameId);
  await updateUsers(gameId);

  setTimeout(async () => {
    await clearGameDataBase(gameId);
  }, 15000);
};
