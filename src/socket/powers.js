import db from "../../db.js";
import { updateGame, updateUsers } from "./game.js";

export const usePower = async (user, socket) => {
  await db("users").where("id", user.id).update({
    canUsePower: false,
  });
};

export const powerRodeur = async (user, target, socket) => {
  await db("users").where("id", user.id).update({
    room: target,
  });
  await updateUsers(user.gameId);
  await updateGame(user.gameId);
};

export const powerKnight = async (user, socket) => {
  await db("users").where("id", user.id).update({
    speed: 0.5,
  });

  setTimeout(async function () {
    await db("users").where("id", user.id).update({
      speed: 1,
    });
    await updateUsers(user.gameId);
    await updateGame(user.gameId);
  }, 5000);
};

export const powerNecromancer = async (user, target, socket) => {
  await db("users").where("id", target.id).update({
    life: 3,
  });
};

export const powerDruide = async (user, target, socket) => {
  await db("users")
    .where("id", target.id)
    .update({
      life: target.life + 1,
    });
};

export const powerWizard = async (user, socket) => {
  const randomInt = Math.floor(Math.random() * 3);
  await db("users").where("id", user.id).update({
    luckDices: randomInt,
  });

  setTimeout(async function () {
    await db("users").where("id", user.id).update({
      luckDices: 0,
    });
    await updateUsers(user.gameId);
    await updateGame(user.gameId);
  }, 5000);
};

export const powerSnake = async (user, socket) => {
  const randomInt = Math.floor(Math.random() * 3) - 3;
  await db("users")
    .whereNot("team", "boss")
    .andWhere("gameId", user.gameId)
    .update({ luckDices: randomInt });

  setTimeout(async function () {
    await db("users").where("id", user.id).update({
      luckDices: 0,
    });
    await updateUsers(user.gameId);
    await updateGame(user.gameId);
  }, 15000);
};

export const powerGolem = async (socket) => {
  const randomInt = Math.floor(Math.random() * 4);
  let user = await db("users").where("id", socket.data.userId).first();
  let inventory = user.inventory;
  let rock;
  if (randomInt == 0) return;
  if (randomInt == 1) rock = "rock";
  if (randomInt == 2) rock = "rockRare";
  if (randomInt == 3) rock = "rockLegendary";

  if (!inventory) {
    inventory = rock;
  } else {
    inventory = inventory + "/" + rock;
  }

  await db("users")
    .where("id", user.id)
    .update({
      inventory: inventory,
      def: user.def + randomInt * 5,
    });
};
