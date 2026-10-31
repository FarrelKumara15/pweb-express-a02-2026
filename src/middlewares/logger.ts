import type { RequestHandler } from "express";

/** Mencatat setiap request di terminal, contoh: GET /api/heroes 200 */
export const logger: RequestHandler = (req, res, next) => {
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
};
