import db from "../db.js";

export default async (req, res) => {
  try {
    const users = await db.select().from("users");
    res.json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).send("Erreur serveur");
  }
};
