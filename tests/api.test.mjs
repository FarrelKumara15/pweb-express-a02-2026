import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import app from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { INT_MAX } from "../src/utils/validators.ts";

const collection = JSON.parse(readFileSync(
  new URL("./fixtures/mlbb-shop.postman_collection.json", import.meta.url), "utf8"
));
let server;
let baseUrl;

before(async () => {
  assert.deepEqual(await Promise.all([
    prisma.hero.count(), prisma.skin.count(), prisma.player.count(), prisma.playerHero.count(),
  ]), [133, 892, 3, 4], "Run npm run seed on a disposable database before API tests");
  assert.deepEqual(await prisma.player.findMany({
    select: { id: true, nickname: true, bp: true, diamond: true }, orderBy: { id: "asc" },
  }), [
    { id: 1, nickname: "ArekITS", bp: 1500, diamond: 75 },
    { id: 2, nickname: "SangPushRank", bp: 13000, diamond: 2892 },
    { id: 3, nickname: "MageSurabaya", bp: 10000, diamond: 0 },
  ]);
  assert.deepEqual(await prisma.playerHero.findMany({
    select: { playerId: true, heroId: true, currency: true, pricePaid: true }, orderBy: { id: "asc" },
  }), [
    { playerId: 1, heroId: 18, currency: "BP", pricePaid: 2000 },
    { playerId: 1, heroId: 1, currency: "BP", pricePaid: 10800 },
    { playerId: 2, heroId: 84, currency: "DIAMOND", pricePaid: 599 },
    { playerId: 2, heroId: 56, currency: "BP", pricePaid: 32000 },
  ]);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await prisma.$disconnect();
});

async function request(method, path, body, expected) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(payload)}`);
  }
  assert.equal(payload.status, response.ok);
  assert.equal(typeof payload.message, "string");
  assert.ok(payload.message.length > 0);
  if (response.ok) {
    assert.ok("data" in payload);
    const paginated = method === "GET" && ["/api/heroes", "/api/skins"].includes(path.split("?")[0]);
    assert.equal("metadata" in payload, paginated);
    if (paginated) {
      assert.deepEqual(Object.keys(payload.metadata).sort(), ["currentPage", "limit", "totalItems", "totalPages"]);
    }
  } else {
    assert.deepEqual(Object.keys(payload).sort(), ["message", "status"]);
  }
  return { code: response.status, ...payload };
}

function createTestPlayer(balances = {}) {
  return prisma.player.create({ data: { nickname: `Test-${randomUUID()}`, ...balances } });
}

async function racePurchases(playerId, bodies) {
  const findUnique = prisma.playerHero.findUnique;
  let release;
  let waiting = 0;
  const ready = new Promise((resolve) => { release = resolve; });
  // Hold completed ownership reads so every request sees the pre-purchase state.
  prisma.playerHero.findUnique = async (args) => {
    const result = await findUnique.call(prisma.playerHero, args);
    if (args.where.playerId_heroId?.playerId === playerId) {
      if (++waiting === bodies.length) release();
      await ready;
    }
    return result;
  };
  try {
    const results = await Promise.all(bodies.map((body) => request("POST", `/api/players/${playerId}/heroes`, body)));
    assert.equal(waiting, bodies.length);
    return results;
  } finally {
    release();
    prisma.playerHero.findUnique = findUnique;
  }
}

test("official Postman collection, cases 01 through 28 in order", async (t) => {
  for (const [index, item] of collection.item.entries()) {
    await t.test(item.name, async () => {
      const source = item.request;
      const url = new URL(source.url.raw);
      const expected = Number(source.description.match(/Hasil yang benar:\s*(\d+)/)[1]);
      const result = await request(source.method, url.pathname + url.search,
        source.body ? JSON.parse(source.body.raw) : undefined, expected);
      const { data, metadata } = result;
      switch (index + 1) {
        case 2:
          assert.equal(metadata.totalItems, 20);
          assert.equal(data.length, 5);
          assert.ok(data.every((hero) => hero.role === "MARKSMAN"));
          break;
        case 3: assert.equal(metadata.totalItems, 10); break;
        case 4:
          assert.equal(data.name, "Layla");
          assert.equal(data.skins.length, 11);
          break;
        case 6: assert.equal(data.id, 134); break;
        case 9:
          assert.equal(metadata.totalItems, 11);
          assert.ok(data.every((skin) => skin.hero.name === "Layla"));
          break;
        case 10: assert.equal(metadata.totalItems, 98); break;
        case 11:
          assert.equal(data.name, "Silverbolt Raiko");
          assert.equal(data.hero.name, "Selena");
          break;
        case 12: assert.deepEqual([data.id, data.bp, data.diamond], [4, 10000, 0]); break;
        case 14: assert.equal(data.diamond, 706); break;
        case 16: assert.deepEqual([data.bpGained, data.bp], [300, 10300]); break;
        case 18:
          assert.deepEqual([data.hero.name, data.currency, data.pricePaid, data.bp, data.diamond],
            ["Freya", "DIAMOND", 599, 10300, 107]);
          break;
        case 19: assert.deepEqual([data.pricePaid, data.bp, data.diamond], [2000, 8300, 107]); break;
        case 22:
          assert.deepEqual(data.heroes.map((owned) => [owned.hero.name, owned.currency, owned.pricePaid]),
            [["Freya", "DIAMOND", 599], ["Layla", "BP", 2000]]);
          break;
        case 23: assert.equal(data.nickname, "MageITS"); break;
        case 25:
          assert.deepEqual([data.totalPlayers, data.totalHeroesOwned, data.totalDiamond], [4, 6, 3074]);
          assert.deepEqual(data.mostOwnedHero, { id: 18, name: "Layla", ownerCount: 2 });
          assert.equal(data.heroesPerRole.reduce((sum, row) => sum + row.count, 0), 134);
          break;
      }
    });
  }
});

test("missing bodies and invalid balance inputs fail before player lookup", async () => {
  await request("POST", "/api/players", undefined, 400);
  await request("POST", "/api/heroes", undefined, 400);
  for (const amount of [undefined, null, "10", 0, -1, 1.5, true, [], {}, INT_MAX + 1]) {
    await request("POST", "/api/players/999/topup", { amount }, 400);
  }
  for (const result of [undefined, null, "LOSER", "win", 1, true]) {
    await request("POST", "/api/players/999/matches", { result }, 400);
  }
  await request("POST", "/api/players/999/topup", { amount: 1 }, 404);
  await request("POST", "/api/players/999/matches", { result: "LOSE" }, 404);
  for (const heroId of [undefined, null, 0, -1, 1.5, true, [], {}, INT_MAX + 1]) {
    await request("POST", "/api/players/999/heroes", { heroId, currency: "BP" }, 400);
  }
  for (const currency of [undefined, null, "bp", "GOLD", 1]) {
    await request("POST", "/api/players/999/heroes", { heroId: 18, currency }, 400);
  }
});

test("purchase and nickname checks stop at the first specified failure", async () => {
  const noPlayer = await request("POST", "/api/players/999/heroes", { heroId: 999, currency: "BP" }, 404);
  assert.match(noPlayer.message, /Player/);
  const noHero = await request("POST", "/api/players/1/heroes", { heroId: 999, currency: "BP" }, 404);
  assert.match(noHero.message, /Hero/);
  const unavailable = await request("POST", "/api/players/3/heroes", { heroId: 22, currency: "BP" }, 400);
  assert.match(unavailable.message, /tidak bisa/);
  await request("POST", "/api/players/1/heroes", { heroId: 18, currency: "BP" }, 409);
  await request("PATCH", "/api/players/999", {}, 404);
  await request("PATCH", "/api/players/1", {}, 400);
});

test("nickname-only writes preserve schema balances and unique nicknames", async () => {
  const nickname = `Test-${randomUUID()}`;
  const { data: player } = await request("POST", "/api/players", { nickname, bp: 0, diamond: INT_MAX }, 201);
  assert.deepEqual([player.bp, player.diamond], [10000, 0]);
  const { data: updated } = await request("PATCH", `/api/players/${player.id}`, { nickname, bp: 7, diamond: 8 }, 200);
  assert.deepEqual([updated.bp, updated.diamond], [10000, 0]);
  await request("POST", "/api/players", { nickname: "   " }, 400);
  await request("POST", "/api/players", { nickname: 42 }, 400);
  const other = await createTestPlayer();
  const shared = `Test-${randomUUID()}`;
  const results = await Promise.all([player.id, other.id].map((id) =>
    request("PATCH", `/api/players/${id}`, { nickname: shared })));
  assert.deepEqual(results.map((result) => result.code).sort(), [200, 409]);
});

test("pagination, combined filters, and invalid IDs keep response envelopes", async () => {
  const { data, metadata } = await request("GET", "/api/heroes?page=2&limit=5", undefined, 200);
  assert.deepEqual(data.map((hero) => hero.id), [6, 7, 8, 9, 10]);
  assert.deepEqual(metadata, { currentPage: 2, limit: 5, totalItems: 134, totalPages: 27 });
  const found = await request("GET", "/api/heroes?search=LAYLA&role=MARKSMAN", undefined, 200);
  assert.deepEqual(found.data.map((hero) => hero.name), ["Layla"]);
  const skins = await request("GET", "/api/skins?heroId=18&rarity=GRAND", undefined, 200);
  assert.ok(skins.data.length > 0);
  assert.ok(skins.data.every((skin) => skin.heroId === 18 && skin.rarity === "GRAND"));
  const capped = await request("GET", "/api/heroes?limit=5000", undefined, 200);
  assert.equal(capped.metadata.limit, 1000);
  const empty = await request("GET", "/api/heroes?search=no-such-hero", undefined, 200);
  assert.deepEqual(empty.data, []);
  assert.equal(empty.metadata.totalPages, 0);
  for (const entity of ["heroes", "skins", "players"]) {
    for (const id of ["0", "-1", "abc", "1.5", String(INT_MAX + 1), "999"]) {
      await request("GET", `/api/${entity}/${id}`, undefined, 404);
    }
  }
  for (const path of ["/api/heroes?role=INVALID", "/api/skins?rarity=INVALID",
    `/api/skins?heroId=${INT_MAX + 1}`, `/api/heroes?page=${Number.MAX_SAFE_INTEGER}&limit=1000`,
    `/api/skins?page=${Number.MAX_SAFE_INTEGER}&limit=1000`]) {
    await request("GET", path, undefined, 400);
  }
});

test("malformed and oversized JSON use failure envelopes", async () => {
  for (const [body, expected] of [["{", 400], [JSON.stringify({ nickname: "x".repeat(110_000) }), 413]]) {
    const response = await fetch(`${baseUrl}/api/players`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    });
    assert.equal(response.status, expected);
    const payload = await response.json();
    assert.equal(payload.status, false);
    assert.deepEqual(Object.keys(payload).sort(), ["message", "status"]);
  }
});

test("WIN, LOSE, and concurrent increments never lose rewards or diamonds", async () => {
  const player = await createTestPlayer();
  const loss = await request("POST", `/api/players/${player.id}/matches`, { result: "LOSE" }, 200);
  assert.deepEqual(loss.data, { result: "LOSE", bpGained: 100, bp: 10100 });
  await Promise.all(Array.from({ length: 5 }, () => Promise.all([
    request("POST", `/api/players/${player.id}/topup`, { amount: 7 }, 200),
    request("POST", `/api/players/${player.id}/matches`, { result: "WIN" }, 200),
  ])));
  const { data } = await request("GET", `/api/players/${player.id}`, undefined, 200);
  assert.deepEqual([data.bp, data.diamond], [11600, 35]);
});

test("concurrent top-ups and matches cannot overflow Int32", async () => {
  const player = await createTestPlayer({ bp: INT_MAX - 300, diamond: INT_MAX - 1 });
  for (const [action, body] of [["topup", { amount: 1 }], ["matches", { result: "WIN" }]]) {
    const results = await Promise.all([1, 2].map(() => request("POST", `/api/players/${player.id}/${action}`, body)));
    assert.deepEqual(results.map((result) => result.code).sort(), [200, 400]);
  }
  await request("POST", `/api/players/${player.id}/topup`, { amount: 1 }, 400);
  await request("POST", `/api/players/${player.id}/matches`, { result: "LOSE" }, 400);
  const { data } = await request("GET", `/api/players/${player.id}`, undefined, 200);
  assert.deepEqual([data.bp, data.diamond], [INT_MAX, INT_MAX]);
});

test("zero prices are purchasable, null prices are not", async () => {
  const player = await createTestPlayer();
  for (const currency of ["BP", "DIAMOND"]) {
    const { data: hero } = await request("POST", "/api/heroes", {
      name: `Test-${randomUUID()}`, role: "MAGE", lane: "MID", releaseYear: 2026,
      priceBP: currency === "BP" ? 0 : null, priceDiamond: currency === "DIAMOND" ? 0 : null,
    }, 201);
    const bought = await request("POST", `/api/players/${player.id}/heroes`, { heroId: String(hero.id), currency }, 201);
    assert.deepEqual([bought.data.pricePaid, bought.data.bp, bought.data.diamond], [0, 10000, 0]);
    await request("POST", `/api/players/${player.id}/heroes`, {
      heroId: hero.id, currency: currency === "BP" ? "DIAMOND" : "BP",
    }, 400);
  }
});

test("overlapping purchases of different heroes cannot overspend either currency", async () => {
  for (const [currency, field, price] of [["BP", "bp", 6500], ["DIAMOND", "diamond", 299]]) {
    const player = await createTestPlayer({ [field]: price });
    const results = await racePurchases(player.id, [2, 3].map((heroId) => ({ heroId, currency })));
    assert.deepEqual(results.map((result) => result.code).sort(), [201, 400]);
    const { data } = await request("GET", `/api/players/${player.id}`, undefined, 200);
    assert.equal(data[field], 0);
    assert.equal(data.heroes.length, 1);
    assert.equal(data.heroes[0].pricePaid, price);
  }
});

test("duplicate purchase races return 409 and roll back the losing debit", async () => {
  for (const [currency, field, price] of [["BP", "bp", 6500], ["DIAMOND", "diamond", 299]]) {
    for (const multiplier of [1, 2]) {
      const player = await createTestPlayer({ [field]: price * multiplier });
      const body = { heroId: 2, currency };
      const results = await racePurchases(player.id, [body, body]);
      assert.deepEqual(results.map((result) => result.code).sort(), [201, 409]);
      const { data } = await request("GET", `/api/players/${player.id}`, undefined, 200);
      assert.equal(data[field], price * (multiplier - 1));
      assert.equal(data.heroes.length, 1);
      assert.equal(data.heroes[0].currency, currency);
    }
  }
  const player = await createTestPlayer({ bp: 6500, diamond: 299 });
  const results = await racePurchases(player.id, ["BP", "DIAMOND"].map((currency) => ({ heroId: 2, currency })));
  assert.deepEqual(results.map((result) => result.code).sort(), [201, 409]);
  const { data } = await request("GET", `/api/players/${player.id}`, undefined, 200);
  assert.equal(data.heroes.length, 1);
  assert.deepEqual([data.bp, data.diamond], data.heroes[0].currency === "BP" ? [0, 299] : [6500, 0]);
});

test("deleting a player cascades ownership without deleting the hero", async () => {
  const player = await createTestPlayer();
  await request("POST", `/api/players/${player.id}/heroes`, { heroId: 18, currency: "BP" }, 201);
  await request("DELETE", `/api/players/${player.id}`, undefined, 200);
  assert.equal(await prisma.playerHero.count({ where: { playerId: player.id } }), 0);
  assert.ok(await prisma.hero.findUnique({ where: { id: 18 } }));
  await request("GET", `/api/players/${player.id}`, undefined, 404);
  await request("DELETE", `/api/players/${player.id}`, undefined, 404);
});

test("statistics handle no ownership and empty tables; hero deletion cascades skins", async () => {
  await prisma.playerHero.deleteMany();
  const unowned = await request("GET", "/api/statistics", undefined, 200);
  assert.equal(unowned.data.mostOwnedHero, null);
  assert.equal(unowned.data.totalHeroesOwned, 0);
  assert.ok(unowned.data.totalPlayers > 0);
  await prisma.player.deleteMany();
  await prisma.hero.deleteMany();
  assert.equal(await prisma.skin.count(), 0);
  const empty = await request("GET", "/api/statistics", undefined, 200);
  assert.deepEqual(empty.data, {
    totalPlayers: 0, totalHeroesOwned: 0, totalDiamond: 0, mostOwnedHero: null, heroesPerRole: [],
  });
});
