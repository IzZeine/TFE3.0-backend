import db from "../../db.js";

export const clearGameDataBase = async (gameId) => {
  console.log(gameId);
  await db("users").where({ gameId }).truncate();
  await db("games").where({ gameId }).truncate();
  await db("rooms").where({ gameId }).truncate();
};
