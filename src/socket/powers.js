import db from "../../db.js";
import { updateGame, updateUsers } from "./game.js";

export const usePower = async (user) => {
  await db("users").where("id", user.id).update({
    canUsePower: false,
  });
};

export const powerRodeur = async (user, target) => {
  let cooldownTime = 1000;
  await db("users").where("id", user.id).update({
    room: target,
  });
  await updateUsers(user.gameId);
  await updateGame(user.gameId);
};

export const powerKnight = async (user) => {
  await db("users").where("id", user.id).update({
    speed: 0.5,
  });
};

export const powerNecromancer = async (target) => {
  await db("users").where("id", target.id).update({
    life: 3,
  });
};

export const powerDruide = async (target) => {
  console.log(target);
  await db("users")
    .where("id", target.id)
    .update({
      life: target.life + 1,
    });
};

export const powerWizard = async (user) => {
  const randomInt = Math.floor(Math.random() * 3);
  await db("users").where("id", user.id).update({
    luckDices: randomInt,
  });
};

export const powerSnake = async (user) => {
  const randomInt = Math.floor(Math.random() * 3) - 3;
  await db("users")
    .whereNot("team", "boss")
    .andWhere("gameId", user.gameId)
    .update({ luckDices: randomInt });
};

const timer = () => {};
