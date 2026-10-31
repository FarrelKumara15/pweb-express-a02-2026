import { HttpError } from "./httpError";
import type { Metadata } from "./response";

export const INT_MAX = 2_147_483_647;

/** req.body di Express 5 bernilai undefined jika tidak ada body. */
export function bodyOf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** Parameter path (mis. :hero_id) harus bilangan bulat positif, kalau tidak -> 404. */
export function parseIdParam(value: string | undefined, label: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new HttpError(404, `${label} tidak ditemukan`);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > INT_MAX) {
    throw new HttpError(404, `${label} tidak ditemukan`);
  }
  return id;
}

/** String tidak kosong setelah di-trim, atau null. */
export function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Bilangan bulat dari number atau string numerik ("22"), atau null. */
export function toInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

/** Cocokkan nilai (tanpa peduli huruf besar/kecil) ke salah satu nilai enum. */
export function toEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return (allowed as readonly string[]).includes(upper) ? (upper as T) : null;
}

/** Query string -> string tunggal (abaikan array/object). */
export function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function parsePagination(query: Record<string, unknown>) {
  const rawPage = toInt(queryString(query.page));
  const rawLimit = toInt(queryString(query.limit));
  const page = rawPage && rawPage > 0 ? rawPage : 1;
  const limit = rawLimit && rawLimit > 0 ? Math.min(rawLimit, 1000) : 10;
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMetadata(
  page: number,
  limit: number,
  totalItems: number
): Metadata {
  return {
    currentPage: page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
}
