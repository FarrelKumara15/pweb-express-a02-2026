import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readCsv(file: string, requiredColumns: string[]): Record<string, string>[] {
  const content = readFileSync(resolve(process.cwd(), "data", file), "utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endRow = () => {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      if (field !== "") throw new Error(`data/${file}: tanda kutip CSV tidak valid`);
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error(`data/${file}: tanda kutip CSV belum ditutup`);
  if (field !== "" || row.length > 0) endRow();

  const [columns, ...data] = rows;
  if (!columns) throw new Error(`data/${file} kosong`);
  for (const column of requiredColumns) {
    if (!columns.includes(column)) throw new Error(`data/${file}: kolom ${column} tidak ada`);
  }

  return data.map((values, index) => {
    if (values.length !== columns.length) {
      throw new Error(`data/${file}: jumlah kolom baris ${index + 2} tidak sesuai header`);
    }
    return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
  });
}
