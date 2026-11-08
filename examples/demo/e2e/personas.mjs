// Đọc e2e/personas.yml (định dạng rất đơn giản: tên → login, password) và đường dẫn storageState.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** @returns {Record<string, { login: string, password: string }>} */
export function personas() {
  const out = {};
  let cur = null;
  for (const line of fs.readFileSync(path.join(DIR, "personas.yml"), "utf8").split("\n")) {
    const top = /^([a-z][a-z0-9-]*):/.exec(line);
    if (top) out[(cur = top[1])] = {};
    const kv = /^\s+(login|password):\s*(\S+)/.exec(line);
    if (kv && cur) out[cur][kv[1]] = kv[2];
  }
  return out;
}

/** storageState của persona, dùng: test.use({ storageState: persona("sale") }) */
export function persona(name) {
  if (!personas()[name]) throw new Error(`Không có persona "${name}" trong e2e/personas.yml`);
  return path.join(DIR, ".auth", `${name}.json`);
}
