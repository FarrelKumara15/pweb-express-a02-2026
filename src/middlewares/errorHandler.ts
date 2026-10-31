import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/httpError";
import { failBody } from "../utils/response";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Error yang kita lempar sendiri
  if (err instanceof HttpError) {
    res.status(err.statusCode).json(failBody(err.message));
    return;
  }

  // JSON body yang rusak (dari express.json())
  if (err?.type === "entity.parse.failed") {
    res.status(400).json(failBody("Body request bukan JSON yang valid"));
    return;
  }

  // Error Prisma sebagai jaring pengaman (mis. race condition)
  if (err?.code === "P2002") {
    res.status(409).json(failBody("Data sudah ada (duplikat)"));
    return;
  }
  if (err?.code === "P2025") {
    res.status(404).json(failBody("Data tidak ditemukan"));
    return;
  }

  console.error(err);
  res.status(500).json(failBody("Terjadi kesalahan pada server"));
};
