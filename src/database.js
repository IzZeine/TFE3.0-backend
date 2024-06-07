import db from "../db.js";

async function resetAllDataBase() {
  await db("users").truncate();
  await db("games").truncate();
  await db("rooms").truncate();
}

async function resetGameDataBase(id) {
  console.log("done");
  // @TODO
}

async function resetPlayerDataBase(id) {
  console.log("done");
  // @TODO
}
