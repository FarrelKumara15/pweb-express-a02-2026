import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { successBody } from "../utils/response";

export const getStatistics: RequestHandler = async (_req, res) => {
  const [totalPlayers, totalHeroesOwned, diamonds, mostOwned, heroesPerRole] = await Promise.all([
    prisma.player.count(),
    prisma.playerHero.count(),
    prisma.player.aggregate({ _sum: { diamond: true } }),
    prisma.playerHero.groupBy({
      by: ["heroId"],
      _count: { heroId: true },
      orderBy: [{ _count: { heroId: "desc" } }, { heroId: "asc" }],
      take: 1,
    }),
    prisma.hero.groupBy({
      by: ["role"],
      _count: { _all: true },
      orderBy: { role: "asc" },
    }),
  ]);

  const top = mostOwned[0];
  const hero = top
    ? await prisma.hero.findUnique({ where: { id: top.heroId }, select: { id: true, name: true } })
    : null;

  res.json(successBody("Berhasil mengambil statistik toko", {
    totalPlayers,
    totalHeroesOwned,
    totalDiamond: diamonds._sum.diamond ?? 0,
    mostOwnedHero: hero && top ? { ...hero, ownerCount: top._count.heroId } : null,
    heroesPerRole: heroesPerRole.map(({ role, _count }) => ({ role, count: _count._all })),
  }));
};
