import itemJson from "./../items.json" assert { type: "json" };

export default async (req, res) => {
  const items = await itemJson;
  res.json(items);
};
