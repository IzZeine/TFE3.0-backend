import db from "../../db.js";
import { io } from "../server.js";

export const updateGame = async (gameId) => {
  const game = await db("games").where("gameId", gameId).first();
  io.to(gameId).emit("updateGame", game);
};

export const reloadUsers = async (gameId) => {
    const users = await db("users").where("gameId", gameId);

    io.to(gameId).emit("updateUsers", users);
};
