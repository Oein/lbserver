import express from "express";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(express.json());
app.all("/*", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/lb", async (req, res) => {
  const gameid = req.query.gameid as string;
  if (!gameid) {
    return res
      .status(400)
      .json({ error: "gameid query parameter is required" });
  }
  const hasGame = (await prisma.game.count({ where: { id: gameid } })) > 0;
  if (!hasGame) {
    return res.status(404).json({ error: "Game not found" });
  }
  const leaderboard = await prisma.score.findMany({
    where: { gameId: gameid },
    orderBy: { value: "desc" },
    take: 10,
  });
  res.json(leaderboard);
});

app.post("/score", async (req, res) => {
  const { gameid, player, value, addi } = req.body;
  if (!gameid || !player || value === undefined) {
    return res
      .status(400)
      .json({ error: "gameid, player, and value are required" });
  }
  const hasGame = (await prisma.game.count({ where: { id: gameid } })) > 0;
  if (!hasGame) {
    return res.status(404).json({ error: "Game not found" });
  }
  const score = await prisma.score.create({
    data: {
      gameId: gameid,
      player,
      value,
      additionalInfo: addi || null,
    },
  });
  res.status(201).json(score);
});

app.post("/game", async (req, res) => {
  const { name } = req.body;
  if (req.headers["authorization"] !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  const game = await prisma.game.create({
    data: {
      id: name,
    },
  });
  res.status(201).json(game);
});

const PORT = process.env.PORT || 16974;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
