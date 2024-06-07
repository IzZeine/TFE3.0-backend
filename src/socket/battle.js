import db from "../../db.js";
import { returnAtSpawn, updateGame, updateUsers } from "./game.js";

export const startBattle = async (room, gameId) => {
  await db("rooms")
    .where("name", `room${room}`)
    .andWhere("gameId", gameId)
    .update({ battle: true });

  await db("users")
    .where("room", room)
    .andWhere("gameId", gameId)
    .update({ inBattle: true });

  await updateGame(gameId);
  await updateUsers(gameId);
};

export const battle = async (data) => {
  let winner;

  let boss = data.filter((user) => user.team == "boss");
  let heroes = data.filter((user) => user.team == "hero");

  let bossLife = boss[0].def;
  let totalHeroesAtk = heroes.reduce((total, hero) => total + hero.atk, 0);

  if (bossLife > totalHeroesAtk) {
    let min = (a, f) => a.reduce((m, x) => (m[f] < x[f] ? m : x));
    let weakestHero = min(heroes, "def");

    await db("users")
      .where("id", weakestHero.id)
      .update("life", weakestHero.life - 1);

    winner = [...boss];
  }

  if (bossLife < totalHeroesAtk) {
    winner = [...heroes];
  }

  if (bossLife == totalHeroesAtk) {
    winner = null;
  }

  return winner;
};

export const endedBattle = async (room, gameId) => {
  await db("rooms")
    .where("name", `room${room}`)
    .andWhere("gameId", gameId)
    .update({ battle: false });

  await db("users")
    .where("room", room)
    .andWhere("gameId", gameId)
    .update({ inBattle: false });

  await returnAtSpawn(gameId, room);

  await updateGame(gameId);
  await updateUsers(gameId);
};
