import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Currency, Lane, PrismaClient, Rarity, Role } from "../src/generated/prisma/client";
import { readCsv } from "./readCsv";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum diisi di file .env");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

// ---------- helper baca & validasi dataset ----------

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s*LANE$/, "");
  if ((allowed as readonly string[]).includes(normalized)) return normalized as T;
  throw new Error(`${label} tidak valid di dataset: "${value}" (pilihan: ${allowed.join(", ")})`);
}

function nullablePrice(value: unknown): number | null {
  return value === null || value === undefined || value === "" ? null : Number(value);
}

// ---------- seed ----------

async function main() {
  const heroesRaw = readCsv("heroes.csv", ["name", "primaryRole", "primaryLane", "releaseYear", "priceBP", "priceDiamond"]);
  const skinsRaw = readCsv("skins.csv", ["name", "heroId", "rarity", "priceDiamond"]);

  // 1) Kosongkan semua tabel + reset id ke 1
  await prisma.$executeRawUnsafe(
    `TRUNCATE "PlayerHero", "Player", "Skin", "Hero" RESTART IDENTITY CASCADE`
  );

  // 2) Hero (id otomatis mengikuti urutan file: Miya = 1 ... Hirara = 133)
  await prisma.hero.createMany({
    data: heroesRaw.map((h) => ({
      name: String(h.name),
      role: enumValue(h.primaryRole, Object.values(Role), `primaryRole (${h.name})`),
      lane: enumValue(h.primaryLane, Object.values(Lane), `primaryLane (${h.name})`),
      releaseYear: Number(h.releaseYear),
      priceBP: nullablePrice(h.priceBP),
      priceDiamond: nullablePrice(h.priceDiamond),
    })),
  });

  // 3) Skin
  await prisma.skin.createMany({
    data: skinsRaw.map((s) => ({
      name: String(s.name),
      heroId: Number(s.heroId),
      rarity: enumValue(s.rarity, Object.values(Rarity), `rarity (${s.name})`),
      priceDiamond: nullablePrice(s.priceDiamond),
    })),
  });

  // 4) Player (dibuat berurutan tanpa id manual supaya sequence ikut maju -> 1, 2, 3)
  const players = [
    { nickname: "ArekITS", bp: 1500, diamond: 75 },
    { nickname: "SangPushRank", bp: 13000, diamond: 2892 },
    { nickname: "MageSurabaya", bp: 10000, diamond: 0 },
  ];
  for (const p of players) {
    await prisma.player.create({ data: p });
  }

  // 5) PlayerHero
  await prisma.playerHero.createMany({
    data: [
      { playerId: 1, heroId: 18, currency: Currency.BP, pricePaid: 2000 }, // Layla
      { playerId: 1, heroId: 1, currency: Currency.BP, pricePaid: 10800 }, // Miya
      { playerId: 2, heroId: 84, currency: Currency.DIAMOND, pricePaid: 599 }, // Ling
      { playerId: 2, heroId: 56, currency: Currency.BP, pricePaid: 32000 }, // Gusion
    ],
  });

  const [heroCount, skinCount, playerCount] = await Promise.all([
    prisma.hero.count(),
    prisma.skin.count(),
    prisma.player.count(),
  ]);
  console.log(`Seed selesai: ${heroCount} hero, ${skinCount} skin, ${playerCount} player`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
