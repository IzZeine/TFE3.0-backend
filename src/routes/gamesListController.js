import db from "../../db.js";
import { Router } from "express";
import { createGame } from "../game.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const rawGames = await db.select().from("games");
    const games = await Promise.all(
      rawGames.map(async (game) => {
        const rooms = await db("rooms").where({ gameId: game.gameId });
        const users = await db("users").where({ gameId: game.gameId });
        return { ...game, users };
      }),
    );
    res.json(games);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur serveur");
  }
});

router.post("/", async (req, res) => {
  const { name } = req.body;
  try {
    // Vérifier si le nom de la partie existe déjà dans la base de données
    const existingGame = await db("games").where("name", name).first();
    if (existingGame) {
      console.log("La partie existe déjà");
      return res
        .status(400)
        .json({ success: false, error: "Game name already exists" });
    }
    const game = await createGame(name);
    return res.json(game);
  } catch (error) {
    console.error("Erreur lors de la création de la partie :", error);
    // Gérer l'erreur ici
  }
});

router.get("/:gameId", async (req, res) => {
  const gameId = req.params.gameId;
  try {
    const game = await db("games").where({ gameId }).first();
    const rooms = await db("rooms").where({ gameId });
    const users = await db("users").where({ gameId });
    if (!game) {
      return res.status(404).json(null);
    }
    res.json({ ...game, rooms, users });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur serveur");
  }
});

export default router;
