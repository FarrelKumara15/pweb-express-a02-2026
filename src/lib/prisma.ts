import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL belum diisi di file .env");
}

// Aplikasi memakai pooled connection string dari Neon
const adapter = new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({ adapter });
