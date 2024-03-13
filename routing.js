import homepageController from "./routeControllers/homepageController.js";
import gamesListController from "./routeControllers/gamesListController.js";
import usersListController from "./routeControllers/usersListController.js";
import heroesListController from "./routeControllers/heroesListController.js";
import itemsListController from "./routeControllers/itemsListController.js";
import bossListController from "./routeControllers/bossListController.js";

export default (app) => {
  app.get("/", homepageController);

  // Route pour récupérer des données depuis la base de données Games
  app.get("/games", gamesListController);

  // Route pour récupérer des données depuis la base de données Users
  app.get("/users", usersListController);

  // Route pour récupérer des données depuis un Json
  app.get("/heroes", heroesListController);

  // Route pour récupérer des données depuis un Json
  app.get("/boss", bossListController);

  // Route pour récupérer des données depuis un Json
  app.get("/items", itemsListController);
};
