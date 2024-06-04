import db from "../../db.js";
import { io } from "../server.js";
import { Timer } from "../models/timer.js";
import { endGame, updateGame, updateUsers } from "./game.js";

const secPerTurn = 20 * 1000;
const maxRounds = 30;

export const Turns = async (gameId) => {
  let round = 1;
  let turn = 1;
  console.log("start turns!");

  async function changeRound() {
    await db("games").where({ gameId }).update({ round });
    await db("users").where({ gameId }).update({ pa: 3 });
    console.log(`Start round ${round}`);

    let game = await db("games").where({ gameId }).first();

    if (game.turn == "hero") {
      console.log("tour du boss");
      await db("games").where({ gameId }).update({ turn: "boss" });
    } else {
      console.log("tour des héros");
      await db("games").where({ gameId }).update({ turn: "hero" });
    }
    await db("users")
      .where({ gameId })
      .andWhere({ team: game.turn })
      .update({ yourTurn: true });
    await db("users")
      .where({ gameId })
      .whereNot({ team: game.turn })
      .update({ yourTurn: false });

    await updateGame(gameId);
    await updateUsers(gameId);

    sendSecToSocket(secPerTurn, gameId); // Envoyez le temps en secondes

    if (turn == 2) {
      turn = 1;
      round++;
    } else {
      turn++;
    }

    if (round > maxRounds || game.statut == "ended") {
      clearInterval(intervalId);
      let boss = await db("users").where({ gameId }).andWhere({ team: "boss" });
      boss = [...boss];
      await endGame(gameId, boss);
    }
  }

  await changeRound();

  // Démarrez le changement de tour toutes les 30 secondes
  const intervalId = setInterval(changeRound, secPerTurn);
};

const sendSecToSocket = (cooldownTime, gameId) => {
  io.to(gameId).emit("cdTurn", secPerTurn / 1000);
  const sendSocket = (elapsedTime) => {
    const seconds = Math.floor(elapsedTime % 60);
    let sendCd = (cooldownTime / 1000 - seconds).toString();
    console.log(sendCd);
    io.to(gameId).emit("cdTurn", sendCd);
  };

  const timer = Timer(sendSocket, 1000);

  timer.start();

  setTimeout(async function () {
    timer.stop();
  }, cooldownTime);
};
