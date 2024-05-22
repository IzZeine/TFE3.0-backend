import homepageController from "./homepageController.js";
import gamesListController from "./gamesListController.js";
import usersListController from "./usersListController.js";
import heroesListController from "./heroesListController.js";
import itemsListController from "./itemsListController.js";
import bossListController from "./bossListController.js";
import roomsConnectionsController from "./roomsConnectionsController.js";
import db from "../../db.js";
import { v4 as uuidv4 } from "uuid";

import { Router } from "express";
import { createGame } from "../game.js";

const router = Router();

router.get("/", homepageController);

// Route pour récupérer des données depuis la base de données Games
router.get("/games", gamesListController);

// Route pour récupérer des données depuis la base de données Users
router.get("/users", usersListController);

// Route pour récupérer des données depuis un Json
router.get("/heroes", heroesListController);

// Route pour récupérer des données depuis un Json
router.get("/boss", bossListController);

// Route pour récupérer des données depuis un Json
router.get("/items", itemsListController);

// Route pour récupérer des données depuis un Json
router.get("/roomsConnections", roomsConnectionsController);

router.post("/creategame", async (req, res) => {
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

// Route pour récupérer les games active
router.get("/activegames", async (req, res) => {
  const activeGames = await db("games").where("statut", "waiting");
  res.json(activeGames);
});

export default router;
