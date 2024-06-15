import db from "../../db.js";
import { generateRandomIndexForKey } from "../helpers.js";
import items from "../../items.json" assert { type: "json" };
import sample from "lodash/sample.js";
import { numberOfSafeRoom } from "../config.js";
import { updateUsers } from "../socket/game.js";

//Ces fonctions doivent être agnostiques du contexte dans lequel elles sont appelées. Elle ne s'occupent que de faire des modifications sur la DB

const keyItem = items.find((item) => item.nameId === "key");

export const updateRooms = async (playerRoom, socket) => {
  let item = items.find((item) => item.nameId === playerRoom.itemId);
  let user = await db("users").where("id", socket.data.userId).first();
  let userDef = Number(user.def);
  let userAtk = Number(user.atk);
  let inventory = user.inventory;

  if (item.type === "def") userDef = userDef + Number(item.bonus);
  if (item.type === "atk") userAtk = userAtk + Number(item.bonus);

  if (!inventory) {
    inventory = playerRoom.itemId;
  } else {
    inventory = inventory + "/" + playerRoom.itemId;
  }

  if (playerRoom.itemId == "key") {
    await db("users").where("id", socket.data.userId).update({
      inventory: inventory,
      def: userDef,
      atk: userAtk,
      hasKey: true,
    });
  } else {
    await db("users").where("id", socket.data.userId).update({
      inventory: inventory,
      def: userDef,
      atk: userAtk,
    });
  }

  user = await db("users").where("id", socket.data.userId).first();

  await updateUsers(socket.data.gameId);

  await db("rooms")
    .where("gameId", playerRoom.gameId)
    .andWhere("name", playerRoom.name)
    .update("itemId", "");

  const rooms = await db("rooms").where({ gameId: playerRoom.gameId });
  return rooms;
};

export const seedGameRooms = async (game) => {
  const randomIndexForKey = generateRandomIndexForKey(game.rooms);
  console.log(randomIndexForKey);
  let otherItems = items.filter((item) => item != keyItem);
  await db.transaction(async (trx) => {
    for (let i = 0; i < game.rooms; i++) {
      let chosenItem = sample(otherItems);
      if (i === 0 || i === numberOfSafeRoom) chosenItem = null;
      if (i === randomIndexForKey) chosenItem = keyItem;
      try {
        // Insérez les salles dans la base de données
        await trx("rooms").insert({
          gameId: game.gameId,
          name: "room" + i,
          itemId: chosenItem?.nameId,
          battle: false,
        });
      } catch (error) {
        console.error("Erreur lors de l'insertion des salles :", error);
      }
    }
  });
  return db("rooms").where({ gameId: game.gameId });
};
