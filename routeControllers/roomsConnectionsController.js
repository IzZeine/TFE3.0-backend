import roomsConnectionsJson from "./../roomsConnections.json" assert { type: "json" };

export default async (req, res) => {
  const roomsConnections = await roomsConnectionsJson;
  res.json(roomsConnections);
};
