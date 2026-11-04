import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Lane, Rarity, Role } from "../src/generated/prisma/enums.ts";
import { HttpError } from "../src/utils/httpError.ts";
import { INT_MAX, parseIdParam, parsePagination } from "../src/utils/validators.ts";

const heroes = JSON.parse(readFileSync(new URL("../data/heroes.json", import.meta.url), "utf8"));
const skins = JSON.parse(readFileSync(new URL("../data/skins.json", import.meta.url), "utf8"));

test("JSON fixtures preserve counts, ID order, and skin references", () => {
  assert.equal(heroes.length, 133);
  assert.equal(skins.length, 892);
  assert.equal(new Set(heroes.map((hero) => hero.name)).size, 133);
  assert.deepEqual(
    [1, 18, 56, 84, 133].map((id) => heroes[id - 1].name),
    ["Miya", "Layla", "Gusion", "Ling", "Hirara"]
  );
  heroes.forEach((hero, index) => {
    assert.equal(hero.id, index + 1);
    assert.ok(Object.values(Role).includes(hero.primaryRole));
    assert.ok(Object.values(Lane).includes(hero.primaryLane));
    assert.ok(Number.isInteger(hero.releaseYear) && hero.releaseYear > 0);
  });
  skins.forEach((skin, index) => {
    assert.equal(skin.id, index + 1);
    assert.equal(heroes[skin.heroId - 1]?.name, skin.hero);
    assert.ok(Object.values(Rarity).includes(skin.rarity));
  });
});

test("fixture prices retain nulls and fit nonnegative Int32", () => {
  assert.equal(heroes.filter((hero) => hero.priceBP === null).length, 2);
  assert.equal(heroes.filter((hero) => hero.priceDiamond === null).length, 1);
  assert.equal(skins.filter((skin) => skin.priceDiamond === null).length, 545);
  assert.equal(heroes[21].name, "Freya");
  assert.equal(heroes[21].priceBP, null);
  for (const price of [...heroes.flatMap((hero) => [hero.priceBP, hero.priceDiamond]), ...skins.map((skin) => skin.priceDiamond)]) {
    assert.ok(price === null || (Number.isInteger(price) && price >= 0 && price <= INT_MAX));
  }
});

test("fixtures match the official collection's filtered counts", () => {
  assert.equal(heroes.filter((hero) => hero.primaryRole === "MARKSMAN").length, 20);
  assert.equal(heroes.filter((hero) => hero.name.toLowerCase().includes("la")).length, 10);
  assert.equal(skins.filter((skin) => skin.heroId === 18).length, 11);
  assert.equal(skins.filter((skin) => skin.rarity === "GRAND").length, 98);
  assert.equal(skins[890].name, "Silverbolt Raiko");
  assert.equal(skins[890].hero, "Selena");
});

test("pagination keeps defaults and the limit cap, rejecting unsafe offsets", () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10, skip: 0 });
  assert.deepEqual(parsePagination({ page: "2", limit: "5" }), { page: 2, limit: 5, skip: 5 });
  assert.deepEqual(parsePagination({ page: "-1", limit: "0" }), { page: 1, limit: 10, skip: 0 });
  assert.equal(parsePagination({ limit: "5000" }).limit, 1000);
  assert.throws(
    () => parsePagination({ page: String(Number.MAX_SAFE_INTEGER), limit: "1000" }),
    (error) => error instanceof HttpError && error.statusCode === 400
  );
});

test("path IDs reject non-positive, fractional, and out-of-Int32 values with 404", () => {
  assert.equal(parseIdParam(String(INT_MAX), "Player"), INT_MAX);
  for (const id of [undefined, "", "0", "-1", "1.5", "1e2", "abc", String(INT_MAX + 1)]) {
    assert.throws(
      () => parseIdParam(id, "Player"),
      (error) => error instanceof HttpError && error.statusCode === 404
    );
  }
});
