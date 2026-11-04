import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Currency, Lane, PrismaClient, Rarity, Role } from "../src/generated/prisma/client";
import heroesRaw from "../data/heroes.json";
import skinsRaw from "../data/skins.json";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum diisi di file .env");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s*LANE$/, "");
  if ((allowed as readonly string[]).includes(normalized)) return normalized as T;
  throw new Error(`${label} tidak valid di dataset: "${value}" (pilihan: ${allowed.join(", ")})`);
}

async function main() {
  assert.equal(heroesRaw.length, 133);
  assert.equal(skinsRaw.length, 892);
  assert.deepEqual(
    [1, 18, 56, 84, 133].map((id) => heroesRaw[id - 1]?.name),
    ["Miya", "Layla", "Gusion", "Ling", "Hirara"]
  );

  // TRUNCATE ikut transaction agar kegagalan insert tidak menghapus data lama.
  const [, heroes, skins, players, ownerships] = await prisma.$transaction([
    prisma.$executeRaw`TRUNCATE "PlayerHero", "Player", "Skin", "Hero" RESTART IDENTITY CASCADE`,
    prisma.hero.createMany({
      data: heroesRaw.map((h) => ({
        name: h.name,
        role: enumValue(h.primaryRole, Object.values(Role), `primaryRole (${h.name})`),
        lane: enumValue(h.primaryLane, Object.values(Lane), `primaryLane (${h.name})`),
        releaseYear: h.releaseYear,
        priceBP: h.priceBP,
        priceDiamond: h.priceDiamond,
      })),
    }),
    prisma.skin.createMany({
      data: skinsRaw.map((s) => ({
        name: s.name,
        heroId: s.heroId,
        rarity: enumValue(s.rarity, Object.values(Rarity), `rarity (${s.name})`),
        priceDiamond: s.priceDiamond,
      })),
    }),
    prisma.player.createMany({
      data: [
        { nickname: "ArekITS", bp: 1500, diamond: 75 },
        { nickname: "SangPushRank", bp: 13000, diamond: 2892 },
        { nickname: "MageSurabaya", bp: 10000, diamond: 0 },
      ],
    }),
    prisma.playerHero.createMany({
      data: [
        { playerId: 1, heroId: 18, currency: Currency.BP, pricePaid: 2000 }, // Layla
        { playerId: 1, heroId: 1, currency: Currency.BP, pricePaid: 10800 }, // Miya
        { playerId: 2, heroId: 84, currency: Currency.DIAMOND, pricePaid: 599 }, // Ling
        { playerId: 2, heroId: 56, currency: Currency.BP, pricePaid: 32000 }, // Gusion
      ],
    }),
  ]);
  console.log(
    `Seed selesai: ${heroes.count} hero, ${skins.count} skin, ` +
    `${players.count} player, ${ownerships.count} PlayerHero`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
