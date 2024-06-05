import db from "../../db.js";

export const clearGameDataBase = async (gameId) => {
  console.log(gameId);
  await db("users").where({ gameId }).del();
  await db("games").where({ gameId }).del();
  await db("rooms").where({ gameId }).del();
};
