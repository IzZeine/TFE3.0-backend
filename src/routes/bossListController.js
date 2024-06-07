import bossJson from "../../boss.json" assert { type: "json" };

export default async (req, res) => {
  const boss = await bossJson;
  res.json(boss);
};
