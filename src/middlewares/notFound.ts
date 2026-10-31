import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`));
};
