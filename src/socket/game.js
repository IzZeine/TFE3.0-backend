import db from "../../db.js";
import { io } from "../server.js";

export const updateGame = async (gameId) => {
  console.log("updateGame", gameId);
  const game = await db("games").where({ gameId }).first();
  const users = await db("users").where({ gameId });
  io.to(gameId).emit("updateGame", { ...game, users });
};

export const updateUsers = async (gameId) => {
  const users = await db("users").where({ gameId });

  io.to(gameId).emit("updateUsers", users);
};
