import db from "../db.js";
import { generateRandomIndexForKey } from "./helpers.js";
import items from "../items.json" assert { type: "json" };
import sample from "lodash/sample.js";
import { numberOfSafeRoom } from "./config.js";

const keyItem = items.find((item) => item.nameId === "key");

export const updateRooms = async (playerRoom) => {
  let item = playerRoom.item;
  let itemJson = JSON.parse(item);
  let user = await db("users").where("id", socket.data.userId).first();
  let userDef = user.def;
  let userAtk = user.atk;
  let inventory = user.inventory;
  //
  if (inventory) inventory = inventory + "/" + item;
  if (!inventory) inventory = item;
  //
  if (itemJson.type === "def") userDef = userDef + Number(itemJson.bonus);
  if (itemJson.type === "atk") userAtk = userAtk + Number(itemJson.bonus);

  await db("users").where("id", socket.data.userId).update({
    inventory: inventory,
    def: userDef,
    atk: userAtk,
  });

  user = await db("users").where("id", socket.data.userId).first();

  reloadUsers();
  socket.emit("updateUser", user);
  await db("rooms")
    .where("gameId", playerRoom.gameId)
    .andWhere("name", playerRoom.name)
    .update("item", "");
  const rooms = await db("rooms").where({ gameId: playerRoom.gameId });
  io.emit("youAskedRooms", rooms);
};

export const seedGameRooms = async (game) => {
  const randomIndexForKey = generateRandomIndexForKey(game.rooms);
  await db.transaction(async (trx) => {
    for (let i = 0; i < game.rooms; i++) {
      let chosenItem = sample(items);
      if (i === 0 || i === numberOfSafeRoom) chosenItem = null;
      if (i === randomIndexForKey) chosenItem = keyItem;
      try {
        // Insérez les salles dans la base de données
        await trx("rooms").insert({
          gameId: game.gameId,
          name: "room" + i,
          itemId: chosenItem?.nameId,
        });
      } catch (error) {
        console.error("Erreur lors de l'insertion des salles :", error);
      }
    }
  });
  return db("rooms").where({ gameId: game.gameId });
};
