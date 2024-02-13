import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

import db from "./db.js";

const sessionID = uuidv4();
// console.log(sessionID);
// initial 1
let gameStep = 1;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  methods: ["GET", "POST"],
});

app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

app.use(function (req, res, next) {
  req.io = io;
  next();
});

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

app.post("/post", (req, res) => {
  console.log("receive", req.params.channel, req.body);
  req.io.emit("post", req.body);
  res.json({ status: "success" });
});

io.on("connection", (socket) => {
  socket.emit("gameStep", gameStep);
  let userID;
  socket.on("MyID", (id) => {
    userID = id;
  });

  // create a user
  socket.on("createUser", async (userData) => {
    let { username } = userData;
    userID = uuidv4(); // Générer un nouvel identifiant UUID
    try {
      // Insérer les données dans la table 'utilisateurs'
      await db.transaction(async (trx) => {
        await trx("users").insert({
          id: userID,
          username,
          inventory_id: userID, // Utiliser le même ID pour l'inventaire
        });
        await trx("inventory").insert({
          id: userID, // Utiliser le même ID pour l'inventaire
          itemName: "default_item", // Nom de l'objet
          quantity: 0, // Quantité initiale
          user_id: userID, // Utiliser le même ID pour l'utilisateur
        });
      });

      // Récupérer la liste mise à jour des utilisateurs
      const users = await db.select().from("users");

      // Envoyer l'ID unique généré au client
      socket.emit("userCreated", { userID });
    } catch (error) {
      console.error("Erreur lors de la création du compte :", error);
      // Gérer l'erreur ici
    }
  });

  // change step of the game
  socket.on("changeStep", (step) => {
    step++;
    gameStep = step;
    console.log(gameStep);
    socket.emit("gameStep", gameStep);
  });

  // add a hero's type to the db
  socket.on("selectedHero", async (selectedhero) => {
    console.log(selectedhero);
    console.log(userID);
    try {
      // Mettre à jour le champ 'hero' dans la table 'users'
      await db("users").where({ id: userID }).update({ hero: selectedhero });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du héros :", error);
      // Gérer l'erreur ici
    }
  });
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

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
