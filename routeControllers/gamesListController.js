import db from "../db.js";

export default async (req, res) => {
  try {
    const games = await db.select().from("games");
    res.json(games);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur serveur");
  }
};
