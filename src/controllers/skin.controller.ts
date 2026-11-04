import type { RequestHandler } from "express";
import { Rarity, type Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import { successBody } from "../utils/response";
import {
  buildMetadata,
  INT_MAX,
  parseIdParam,
  parsePagination,
  queryString,
  toEnum,
  toInt,
} from "../utils/validators";

const RARITIES = Object.values(Rarity);

// GET /api/skins?page=&limit=&heroId=&rarity=
export const getAllSkins: RequestHandler = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const heroIdQuery = queryString(req.query.heroId);
  const rarityQuery = queryString(req.query.rarity);

  const where: Prisma.SkinWhereInput = {};

  if (heroIdQuery) {
    const heroId = toInt(heroIdQuery);
    if (heroId === null || heroId < 1 || heroId > INT_MAX) {
      throw new HttpError(400, "heroId harus bilangan bulat positif dalam rentang Int32");
    }
    where.heroId = heroId;
  }

  if (rarityQuery) {
    const rarity = toEnum(rarityQuery, RARITIES);
    if (!rarity) {
      throw new HttpError(400, `rarity tidak valid. Pilihan: ${RARITIES.join(", ")}`);
    }
    where.rarity = rarity;
  }

  const [totalItems, skins] = await Promise.all([
    prisma.skin.count({ where }),
    prisma.skin.findMany({
      where,
      include: { hero: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
  ]);

  res.json(
    successBody("Berhasil mengambil data skin", skins, buildMetadata(page, limit, totalItems))
  );
};

// GET /api/skins/:skin_id
export const getSkinById: RequestHandler = async (req, res) => {
  const id = parseIdParam(req.params.skin_id as string, "Skin");

  const skin = await prisma.skin.findUnique({
    where: { id },
    include: { hero: true },
  });

  if (!skin) throw new HttpError(404, "Skin tidak ditemukan");

  res.json(successBody("Berhasil mengambil detail skin", skin));
};
