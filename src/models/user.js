import db from "../../db.js";

//Ces fonctions doivent être agnostiques du contexte dans lequel elles sont appelées. Elle ne s'occupent que de faire des modifications sur la DB

export const createUser = async ({ username, gameId }, callback) => {
  const createdIds = await db("users").insert({
    username,
    gameId,
    room: "0",
    life: 3,
    speed: 1,
  });
  const userID = createdIds[0];
  const user = await db("users").where({ id: userID }).first();
  console.log("CREATED USER", user.id, "in game", user.gameId);
  return user;
};
