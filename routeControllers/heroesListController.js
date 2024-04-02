import heroesJson from "./../heroes.json" assert { type: "json" };

export default async (req, res) => {
  const heroes = await heroesJson;
  res.json(heroes);
};
