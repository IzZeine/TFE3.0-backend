import db from "../../db.js";
import { io } from "../server.js";
import { Timer } from "../models/timer.js";
import { endGame, updateGame, updateUsers } from "./game.js";

const secPerTurn = 15 * 1000;
const maxRounds = 30;

export const Turns = async (gameId) => {
  let round = 1;
  let turn = 1;

  async function changeRound() {
    let game = await db("games").where({ gameId }).first();

    await db("users")
      .where({ gameId })
      .andWhere({ team: game.turn })
      .update({ yourTurn: true });
    await db("users")
      .where({ gameId })
      .whereNot({ team: game.turn })
      .update({ yourTurn: false });

    io.to(game.gameId).emit("changeTurn", game.turn);

    if (game.turn == "hero") {
      await db("games").where({ gameId }).update({ turn: "boss" });
    } else {
      await db("games").where({ gameId }).update({ turn: "hero" });
    }
    sendSecToSocket(secPerTurn, gameId); // Envoyez le temps en secondes

    if (turn == 2) {
      turn = 1;

      round++;
      await db("games").where({ gameId }).update({ round });
      await db("users")
        .where({ gameId })
        .andWhere({ team: "hero" })
        .update({ pa: 3, luckDices: 0 });
      await db("users")
        .where({ gameId })
        .andWhere({ team: "boss" })
        .update({ pa: 5, luckDices: 0 });
    } else {
      const users = await db("users").where({ gameId });
      users.forEach(async (user) => {
        if (user.cdPower <= 0) {
          await db("users")
            .where({ id: user.id })
            .update({ canUsePower: true });
        } else {
          await db("users")
            .where({ id: user.id })
            .update({ cdPower: user.cdPower - 1 });
          if (user.cdPower == 1) {
            await db("users")
              .where({ id: user.id })
              .update({ canUsePower: true });
          }
        }
      });
      turn++;
    }

    await updateGame(gameId);
    await updateUsers(gameId);

    if (round > maxRounds || game.statut == "ended") {
      clearInterval(intervalId);
      io.to(gameId).emit("endGameTurn", "boss");

      setTimeout(async function () {
        await endGame(gameId, "boss");
      }, 3000);
    }
  }

  // Démarrez le changement de tour toutes les 30 secondes
  const intervalId = setInterval(changeRound, secPerTurn);
};

const sendSecToSocket = (cooldownTime, gameId) => {
  io.to(gameId).emit("cdTurn", secPerTurn / 1000);
  const sendSocket = (elapsedTime) => {
    const seconds = Math.floor(elapsedTime % 60);
    let sendCd = (cooldownTime / 1000 - seconds).toString();
    io.to(gameId).emit("cdTurn", sendCd);
  };

  const timer = Timer(sendSocket, 1000);

  timer.start();

  setTimeout(async function () {
    timer.stop();
  }, cooldownTime);
};
