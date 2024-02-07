import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

import db from "./db.js";
import { log } from "node:console";

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

const onlineUsers = new Set(); // Ensemble pour stocker les IDs des utilisateurs en ligne
let onlineUsersCount = 0
const MAX_USERS = 2;

io.on("connection", (socket) => {
  // console.log("a user connected");

  socket.on("sessionID",(ID)=>{
    // Mettre un if sinon quand je crée un user et qu'il n'a pas encore d'ID il ajoute un "null" à mon onlineUsers
    if(ID){
      socket.id = ID
      onlineUsers.add(socket.id);
      onlineUsersCount = onlineUsers.size;
      io.emit("playerCount", onlineUsersCount);
      console.log(onlineUsers)
      if (onlineUsersCount > MAX_USERS) {
        console.log("redirect")
        // Renvoyer le nouvel utilisateur vers une page d'erreur 404
        socket.emit("redirect", "/lotOfUsers");
        socket.disconnect(); // Déconnecter le client
        return;
      }
    }
  })

  socket.on("disconnect", () => {
    console.log("user disconnected");
    onlineUsers.delete(socket.id); // Lorsqu'un utilisateur se déconnecte, retirez son ID de l'ensemble des utilisateurs en ligne
    onlineUsersCount=onlineUsers.size;
    io.emit("playerCount", onlineUsers.size); // Envoyer le nouveau nombre de joueurs en ligne à tous les clients
    console.log(onlineUsers)
  });

  socket.on("createUser", async (userData) => {
    const { username } = userData;
    const userID = uuidv4(); // Générer un nouvel identifiant UUID
    socket.id = userID

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
});

// Route pour créer un compte (POST)

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