import type { RequestHandler } from "express";
import { Currency, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import { successBody } from "../utils/response";
import { bodyOf, INT_MAX, nonEmptyString, parseIdParam, toInt } from "../utils/validators";

export const createPlayer: RequestHandler = async (req, res) => {
  const nickname = nonEmptyString(bodyOf(req.body).nickname);
  if (!nickname) throw new HttpError(400, "nickname wajib diisi");

  const player = await prisma.player.create({ data: { nickname } });
  res.status(201).json(successBody("Player berhasil dibuat", player));
};

export const getPlayerById: RequestHandler = async (req, res) => {
  const id = parseIdParam(req.params.player_id as string, "Player");
  const player = await prisma.player.findUnique({
    where: { id },
    include: { heroes: { include: { hero: true }, orderBy: { id: "asc" } } },
  });
  if (!player) throw new HttpError(404, "Player tidak ditemukan");

  res.json(successBody("Berhasil mengambil detail player", player));
};

export const updatePlayer: RequestHandler = async (req, res) => {
  const id = parseIdParam(req.params.player_id as string, "Player");
  const existing = await prisma.player.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Player tidak ditemukan");

  const nickname = nonEmptyString(bodyOf(req.body).nickname);
  if (!nickname) throw new HttpError(400, "nickname wajib diisi");

  const player = await prisma.player.update({ where: { id }, data: { nickname } });
  res.json(successBody("Nickname berhasil diubah", player));
};

export const deletePlayer: RequestHandler = async (req, res) => {
  const id = parseIdParam(req.params.player_id as string, "Player");
  const player = await prisma.player.delete({ where: { id } });
  res.json(successBody("Player berhasil dihapus", player));
};

async function incrementBalance(id: number, field: "bp" | "diamond", amount: number) {
  try {
    // Batas diperiksa pada UPDATE agar request paralel tidak melewati Int32.
    return await prisma.player.update({
      where: { id, [field]: { lte: INT_MAX - amount } },
      data: { [field]: { increment: amount } },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
      throw err;
    }
    const player = await prisma.player.findUnique({ where: { id }, select: { id: true } });
    if (!player) throw new HttpError(404, "Player tidak ditemukan");
    throw new HttpError(400, `Saldo ${field === "bp" ? "BP" : "Diamond"} melebihi batas maksimum`);
  }
}

export const topUp: RequestHandler = async (req, res) => {
  const { amount } = bodyOf(req.body);
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > INT_MAX) {
    throw new HttpError(400, `amount harus bilangan bulat lebih dari 0 dan maksimal ${INT_MAX}`);
  }

  const id = parseIdParam(req.params.player_id as string, "Player");
  const player = await incrementBalance(id, "diamond", amount);
  res.json(successBody("Top up berhasil", { diamond: player.diamond }));
};

export const playMatch: RequestHandler = async (req, res) => {
  const { result } = bodyOf(req.body);
  if (result !== "WIN" && result !== "LOSE") {
    throw new HttpError(400, "result harus WIN atau LOSE");
  }

  const id = parseIdParam(req.params.player_id as string, "Player");
  const bpGained = result === "WIN" ? 300 : 100;
  const player = await incrementBalance(id, "bp", bpGained);
  res.json(successBody("Hadiah match berhasil ditambahkan", { result, bpGained, bp: player.bp }));
};

export const buyHero: RequestHandler = async (req, res) => {
  const body = bodyOf(req.body);
  const heroId = toInt(body.heroId);
  const currency = body.currency;
  if (
    heroId === null || heroId < 1 || heroId > INT_MAX ||
    (currency !== Currency.BP && currency !== Currency.DIAMOND)
  ) {
    throw new HttpError(400, "heroId harus bilangan bulat positif dan currency harus BP atau DIAMOND");
  }

  const id = parseIdParam(req.params.player_id as string, "Player");
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) throw new HttpError(404, "Player tidak ditemukan");

  const hero = await prisma.hero.findUnique({ where: { id: heroId } });
  if (!hero) throw new HttpError(404, "Hero tidak ditemukan");

  const price = currency === Currency.BP ? hero.priceBP : hero.priceDiamond;
  if (price === null) throw new HttpError(400, `${hero.name} tidak bisa dibeli dengan ${currency}`);

  const owned = await prisma.playerHero.findUnique({
    where: { playerId_heroId: { playerId: id, heroId } },
    select: { id: true },
  });
  if (owned) throw new HttpError(409, "Player sudah memiliki hero ini");

  const field = currency === Currency.BP ? "bp" : "diamond";
  if (player[field] < price) throw new HttpError(400, `Saldo ${currency} tidak cukup`);

  try {
    const [updated] = await prisma.$transaction([
      prisma.player.update({
        // Saldo dicek lagi saat UPDATE, setelah menunggu transaksi pembelian lain.
        where: { id, [field]: { gte: price } },
        data: { [field]: { decrement: price } },
      }),
      prisma.playerHero.create({ data: { playerId: id, heroId, currency, pricePaid: price } }),
    ]);

    res.status(201).json(successBody("Hero berhasil dibeli", {
      hero,
      currency,
      pricePaid: price,
      bp: updated.bp,
      diamond: updated.diamond,
    }));
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
      throw err;
    }
    const current = await prisma.player.findUnique({
      where: { id },
      select: { heroes: { where: { heroId }, select: { id: true } } },
    });
    if (!current) throw new HttpError(404, "Player tidak ditemukan");
    // Pembelian paralel hero yang sama tetap 409 meski saldonya kini kurang.
    if (current.heroes.length > 0) throw new HttpError(409, "Player sudah memiliki hero ini");
    throw new HttpError(400, `Saldo ${currency} tidak cukup`);
  }
};
