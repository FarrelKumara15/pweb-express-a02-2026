# pweb-express-a02-2026

Backend MLBB Shop untuk Modul 4: Express 5, TypeScript, Prisma ORM 7, PostgreSQL di Neon,
dan `@prisma/adapter-neon`.

## Setup

Gunakan Node.js `^20.19`, `^22.12`, atau `>=24` sesuai engine Prisma pada lockfile.
Jalankan semua perintah dari root repository.

```bash
npm ci
cp .env.example .env
```

Isi `.env` dengan `DATABASE_URL` pooled dan `DIRECT_URL` direct dari **branch Neon yang sama**.
`PORT` default 3000. `.env` sudah masuk `.gitignore`.

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run typecheck
```

`migrate deploy` menerapkan migration yang sudah tersedia di repository.
Generated client berada di `src/generated/prisma` dan perlu dibuat ulang setelah perubahan schema.
Untuk migrasi berikutnya, gunakan `npx prisma migrate dev --name <nama_perubahan>`.

## Dataset dan seed

`data/heroes.json` dan `data/skins.json` dikonversi dari CSV pada
[dataset resmi](https://drive.google.com/file/d/1pwBUD6HnjybfGc4sobwSDYF7myHA7rW3/view).
Seluruh kolom dan urutan dipertahankan; harga kosong menjadi `null`.
Seed hanya menyimpan kolom yang diminta modul dan membiarkan database membuat ID sesuai urutan file.

**Seed menghapus isi empat tabel dan mereset ID. Gunakan database demo/disposable.**
Pengosongan dan seluruh insert berada dalam satu transaction sehingga kegagalan insert membatalkan reset.

```bash
npm run seed
npm run studio
```

Hasil: 133 Hero, 892 Skin, 3 Player, dan 4 PlayerHero.
ID acuan: Miya=1, Layla=18, Gusion=56, Ling=84, Hirara=133.

## Menjalankan API

```bash
npm run dev
```

`npm start` menjalankan server tanpa watch. Cek liveness dengan:

```bash
curl -i http://localhost:3000/health
```

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/api/heroes` | Pagination, `search`, `role` |
| GET | `/api/heroes/:hero_id` | Detail hero beserta skin |
| POST | `/api/heroes` | Tambah hero |
| GET | `/api/skins` | Pagination, `heroId`, `rarity` |
| GET | `/api/skins/:skin_id` | Detail skin beserta hero |
| POST | `/api/players` | Buat player dengan nickname |
| GET | `/api/players/:player_id` | Detail player dan kepemilikan hero |
| PATCH | `/api/players/:player_id` | Ubah nickname |
| DELETE | `/api/players/:player_id` | Hapus player beserta kepemilikannya |
| POST | `/api/players/:player_id/topup` | Tambah Diamond, body `{ "amount": 706 }` |
| POST | `/api/players/:player_id/matches` | Tambah BP, body `{ "result": "WIN" }` atau `"LOSE"` |
| POST | `/api/players/:player_id/heroes` | Beli hero, body `{ "heroId": 18, "currency": "BP" }` |
| GET | `/api/statistics` | Total player, kepemilikan, Diamond, hero terpopuler, dan jumlah per role |

Response sukses memakai `{ status: true, message, data }`; gagal memakai `{ status: false, message }`.
Hanya daftar hero/skin memiliki `metadata`: `currentPage`, `limit`, `totalItems`, `totalPages`.
Pagination default page 1, limit 10; limit maksimal 1000.

Create/PATCH Player hanya menulis nickname. Saldo awal memakai default schema: 10000 BP dan 0 Diamond.
Top-up mengembalikan `data.diamond`; match mengembalikan `data.result`, `data.bpGained`, dan `data.bp`.
Pembelian mengembalikan `data.hero`, `data.currency`, `data.pricePaid`, `data.bp`, dan `data.diamond`.
Saldo diperiksa kembali pada atomic update di dalam transaction agar pembelian paralel tidak membuat saldo negatif.

Statistik `mostOwnedHero` berbentuk `{ id, name, ownerCount }`, atau `null` jika belum ada kepemilikan.
Jika jumlah pemilik seri, hero dengan ID terkecil dipilih. `heroesPerRole` berupa array `{ role, count }`.

## Verifikasi

Pemeriksaan fixture JSON dan validator, tanpa koneksi database:

```bash
npm run typecheck
npm test
```

Salinan [collection resmi](https://drive.google.com/file/d/1bi5FbMwt2Ai9oBqhLwg2fAm7rSr5xh6c/view)
tersedia di `tests/fixtures/mlbb-shop.postman_collection.json` untuk diimpor ke Postman.

Suite API menjalankan 28 kasus resmi sesuai urutan, kemudian validasi, cascade, overflow, pembelian paralel,
rollback debit duplikat, serta statistik kosong. Server tes memakai port lokal otomatis.
**Suite ini memerlukan database disposable yang baru di-seed dan mengosongkan tabel pada tes terakhir.**

```bash
npm run seed
npm run test:api
npm run seed
```

Seed terakhir mengembalikan fixture awal untuk demo berikutnya.

## Demo di Postman

1. Jalankan `npm run seed` pada database demo, lalu `npm run dev`.
2. Import `tests/fixtures/mlbb-shop.postman_collection.json` ke Postman.
3. Kirim request **01 sampai 28 secara berurutan**. Collection memakai `http://localhost:3000`;
   sesuaikan URL jika menggunakan port lain.
4. Pada kasus 25, statistik harus menunjukkan 4 player, 6 kepemilikan hero, dan total 3074 Diamond.
   Layla menjadi hero terbanyak dimiliki, dengan 2 pemilik.
5. Jalankan `npm run seed` lagi sebelum mengulang demo dari kasus 01.
