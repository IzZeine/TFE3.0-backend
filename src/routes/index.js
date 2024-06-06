import gamesListController from "./gamesListController.js";
import usersListController from "./usersListController.js";
import heroesListController from "./heroesListController.js";
import itemsListController from "./itemsListController.js";
import bossListController from "./bossListController.js";
import roomsConnectionsController from "./roomsConnectionsController.js";
import roomsListController from "./roomsListController.js";
import db from "../../db.js";

import { Router } from "express";

const router = Router();

// Route pour récupérer des données depuis la base de données Games
router.use("/games", gamesListController);

// Route pour récupérer des données depuis la base de données Users
router.get("/users", usersListController);

// Route pour récupérer des données depuis un Json
router.get("/heroes", heroesListController);

// Route pour récupérer des données depuis un Json
router.get("/boss", bossListController);

// Route pour récupérer des données depuis un Json
router.get("/items", itemsListController);

// Route pour récupérer des données depuis un Json
router.get("/roomsInfos", roomsListController);

// Route pour récupérer des données depuis un Json
router.get("/roomsConnections", roomsConnectionsController);

// Route pour récupérer les games active
router.get("/activegames", async (req, res) => {
  const activeGames = await db("games").where("statut", "waiting");
  res.json(activeGames);
});

export default router;
