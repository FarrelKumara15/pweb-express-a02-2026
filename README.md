# MLBB Shop - Modul 4 PWEB (Bagian: Fitur 1 Middleware, Fitur 2 Hero, Fitur 3 Skin)

Backend Express 5 + TypeScript + Prisma 7 + PostgreSQL (Neon, via `@prisma/adapter-neon`).

## Cara menjalankan

1. Install dependency
   ```bash
   npm install
   ```
2. Salin `.env.example` menjadi `.env`, lalu isi dua connection string dari Neon
   - `DATABASE_URL` : pooled (host mengandung `-pooler`), dipakai aplikasi
   - `DIRECT_URL`   : direct, dipakai `prisma migrate`
3. Migrasi dan generate client
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```
4. Unduh dataset ZIP dari tautan soal, lalu ekstrak `heroes.csv` dan `skins.csv` ke folder `data/`. Seed membaca CSV langsung; konversi ke JSON tidak diperlukan.
5. Seed (harus menghasilkan 133 hero, 892 skin, 3 player)
   ```bash
   npx tsx prisma/seed.ts
   ```
6. Jalankan server
   ```bash
   npm run dev
   ```
   Buka http://localhost:3000/health

Seed dijalankan ulang sebelum demo / sebelum mengimpor koleksi Postman.

## Struktur

```
prisma/schema.prisma      4 tabel + 4 enum
prisma/seed.ts            TRUNCATE -> hero -> skin -> player -> playerHero
src/app.ts                logger, json, /health, /api, notFound, errorHandler
src/middlewares/          logger, notFound, errorHandler
src/controllers/          hero, skin
src/routes/index.ts       seluruh endpoint /api
src/utils/                HttpError, format response, validator
```

## Endpoint

| Metode | Endpoint |
| --- | --- |
| GET | /health |
| GET / POST | /api/heroes |
| GET | /api/heroes/:hero_id |
| GET | /api/skins , /api/skins/:skin_id |

File `.env` tidak boleh di-commit (sudah ada di `.gitignore`).
