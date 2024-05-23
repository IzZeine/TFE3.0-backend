import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cors from "cors";
import index from "./routes/index.js";

export const app = express();
export const server = createServer(app);
export const io = new Server(server, {
  cors: { origin: "*" },
  methods: ["GET", "POST"],
});

app.use(bodyParser.json());
app.use(express.json());
app.use(cors());
app.use(index);

app.use(function (req, res, next) {
  req.io = io;
  next();
});

server.listen(process.env.PORT, () => {
  console.log(`server running at http://localhost:${process.env.PORT}`);
});
