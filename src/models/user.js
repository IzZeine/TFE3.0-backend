import db from "../../db.js";

export const createUser = async ({ username, gameId }, callback) => {
  const createdIds = await db("users").insert({
    username,
    gameId,
    room: "0",
    life: 3,
    speed: 1,
  });
  const userID = createdIds.pop();
  return db("users").where("id", userID).first();
};
