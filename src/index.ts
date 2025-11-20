import express from "express";
import { prisma } from "./lib/prisma.js";
import path from "path";

const app = express();

app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use("/", express.static(path.join(__dirname, "..", "public")));

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
    select: {
      player: true,
      value: true,
      additionalInfo: true,
    },
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

app.post("/scores", async (req, res) => {
  const { gameid, scores } = req.body;
  if (!gameid || !Array.isArray(scores)) {
    return res
      .status(400)
      .json({ error: "gameid and scores array are required" });
  }
  const hasGame = (await prisma.game.count({ where: { id: gameid } })) > 0;
  if (!hasGame) {
    return res.status(404).json({ error: "Game not found" });
  }
  const createdScores = [];
  for (const scoreData of scores) {
    const { player, value, addi } = scoreData;
    if (!player || value === undefined) {
      return res
        .status(400)
        .json({ error: "Each score must have player and value" });
    }
    const score = await prisma.score.create({
      data: {
        gameId: gameid,
        player,
        value,
        additionalInfo: addi || null,
      },
    });
    createdScores.push(score);
  }
  res.status(201).json(createdScores);
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

app.get("/api/games", async (req, res) => {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      _count: {
        select: { scores: true },
      },
    },
  });
  res.json(games);
});

app.get("/api/scores", async (req, res) => {
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

  const page = parseInt(req.query.page as string) || 1;
  const limit = 50;
  const skip = (page - 1) * limit;

  const [scores, totalCount] = await Promise.all([
    prisma.score.findMany({
      where: { gameId: gameid },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        game: true,
      },
    }),
    prisma.score.count({ where: { gameId: gameid } }),
  ]);

  res.json({
    scores,
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  });
});

const PORT = process.env.PORT || 16974;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
