import type { RequestHandler } from "express";
import { Lane, Role, type Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import { successBody } from "../utils/response";
import {
  bodyOf,
  buildMetadata,
  INT_MAX,
  nonEmptyString,
  parseIdParam,
  parsePagination,
  queryString,
  toEnum,
  toInt,
} from "../utils/validators";

const ROLES = Object.values(Role);
const LANES = Object.values(Lane);

// GET /api/heroes?page=&limit=&search=&role=
export const getAllHeroes: RequestHandler = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = queryString(req.query.search);
  const roleQuery = queryString(req.query.role);

  const where: Prisma.HeroWhereInput = {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (roleQuery) {
    const role = toEnum(roleQuery, ROLES);
    if (!role) {
      throw new HttpError(400, `role tidak valid. Pilihan: ${ROLES.join(", ")}`);
    }
    where.role = role;
  }

  const [totalItems, heroes] = await Promise.all([
    prisma.hero.count({ where }),
    prisma.hero.findMany({ where, orderBy: { id: "asc" }, skip, take: limit }),
  ]);

  res.json(
    successBody("Berhasil mengambil data hero", heroes, buildMetadata(page, limit, totalItems))
  );
};

// GET /api/heroes/:hero_id
export const getHeroById: RequestHandler = async (req, res) => {
  const id = parseIdParam(req.params.hero_id as string, "Hero");

  const hero = await prisma.hero.findUnique({
    where: { id },
    include: { skins: { orderBy: { id: "asc" } } },
  });

  if (!hero) throw new HttpError(404, "Hero tidak ditemukan");

  res.json(successBody("Berhasil mengambil detail hero", hero));
};

// Harga opsional: kosong/null -> null, selain itu harus bilangan bulat >= 0
function parsePrice(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = toInt(value);
  if (n === null || n < 0 || n > INT_MAX) {
    throw new HttpError(400, `${field} harus bilangan bulat tidak negatif atau dikosongkan`);
  }
  return n;
}

// POST /api/heroes
export const createHero: RequestHandler = async (req, res) => {
  const body = bodyOf(req.body);

  const name = nonEmptyString(body.name);
  const roleRaw = body.role;
  const laneRaw = body.lane;
  const releaseYearRaw = body.releaseYear;

  // 1) Field wajib tidak diisi -> 400
  if (
    !name ||
    roleRaw === undefined || roleRaw === null || roleRaw === "" ||
    laneRaw === undefined || laneRaw === null || laneRaw === "" ||
    releaseYearRaw === undefined || releaseYearRaw === null || releaseYearRaw === ""
  ) {
    throw new HttpError(400, "name, role, lane, dan releaseYear wajib diisi");
  }

  const role = toEnum(roleRaw, ROLES);
  if (!role) {
    throw new HttpError(400, `role tidak valid. Pilihan: ${ROLES.join(", ")}`);
  }
  const lane = toEnum(laneRaw, LANES);
  if (!lane) {
    throw new HttpError(400, `lane tidak valid. Pilihan: ${LANES.join(", ")}`);
  }
  const releaseYear = toInt(releaseYearRaw);
  if (releaseYear === null || releaseYear < 1 || releaseYear > INT_MAX) {
    throw new HttpError(400, "releaseYear harus bilangan bulat");
  }
  const priceBP = parsePrice(body.priceBP, "priceBP");
  const priceDiamond = parsePrice(body.priceDiamond, "priceDiamond");

  // 2) Nama hero sudah ada -> 409
  const existing = await prisma.hero.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, `Hero dengan nama ${name} sudah ada`);

  // 3) Berhasil -> 201
  const hero = await prisma.hero.create({
    data: { name, role, lane, releaseYear, priceBP, priceDiamond },
  });

  res.status(201).json(successBody("Hero berhasil dibuat", hero));
};
