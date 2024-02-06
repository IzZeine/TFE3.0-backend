const express = require("express");
const path = require("path");
const db = require("./db.js");
const cors = require("cors");
const http = require("node:http");
const { Server } = require("socket.io");

const app = express();
const port = 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(express.json());
app.use(cors());

io.on("connection", (socket) => {
  console.log("connection");
});

// Route pour créer un compte (POST)
app.post("/create-account", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Insérer les données dans la table 'utilisateurs'
    const [newUserId] = await db("users").insert({
      username,
      password,
    });

    // Créer un inventaire par défaut pour le nouvel utilisateur
    const [newInventoryId] = await db("inventory").insert({
      itemName: "default_item",
      quantity: 0,
    });

    // Associer l'inventaire au nouvel utilisateur
    await db("users")
      .where("ID", newUserId)
      .update({ inventory_id: newInventoryId });

    // Récupérer la liste mise à jour des utilisateurs
    const users = await db.select().from("users");
    res.json(users);
  } catch (error) {
    console.error("Erreur lors de la création du compte :", error);
    res.status(500).send("Erreur serveur");
  }
});

// Route pour récupérer des données depuis la base de données
app.get("/users", async (req, res) => {
  try {
    const users = await db.select().from("users");
    res.json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur serveur");
  }
});

app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${port}`);
});
