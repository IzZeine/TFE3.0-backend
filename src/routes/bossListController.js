import heroesJson from "../../boss.json" assert { type: "json" };

export default async (req, res) => {
  const boss = await heroesJson;
  res.json(boss);
};
