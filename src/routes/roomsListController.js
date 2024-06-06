import roomsJson from "../../rooms.json" assert { type: "json" };

export default async (req, res) => {
  const rooms = await roomsJson;
  res.json(rooms);
};
