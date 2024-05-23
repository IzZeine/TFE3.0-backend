import db from "../../db.js";
import { io } from "../server.js";
import { getAllGames } from "../models/game.js";

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
