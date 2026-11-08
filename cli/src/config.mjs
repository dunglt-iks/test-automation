// @ts-check
// Đọc taf.config.yml của dự án và điền giá trị mặc định. Xem docs/01-architecture.md §3.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export class TafError extends Error {}

const DEFAULTS = {
  spec: {
    roots: ["docs/features"],
    featurePattern: "(?:[A-Z]{2,4}|CORE-C\\d{2})-F\\d{2}",
    normalize: [],
    statusSource: "prd-fsd",
    approvedValue: "Đã duyệt",
  },
  testcases: { dir: "docs/testcases" },
  scripts: { allowedPaths: [], personas: null },
  trigger: {
    codePaths: [],
    statusFile: null,
    statusDone: ["Hoàn thành"],
    skipLabel: "e2e-skip",
  },
  gate: { blockedLabel: "e2e-blocked" },
};

/**
 * @param {{ root?: string, config?: string }} [opts]
 */
export function loadConfig(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const file = opts.config
    ? path.resolve(opts.config)
    : path.join(root, "taf.config.yml");
  if (!fs.existsSync(file))
    throw new TafError(`Không thấy file cấu hình ${file}`);
  const raw = YAML.parse(fs.readFileSync(file, "utf8")) || {};
  if (raw.version !== 1) throw new TafError(`${file}: chỉ hỗ trợ version: 1`);
  /** @type {any} */
  const cfg = { root, file };
  for (const [k, def] of Object.entries(DEFAULTS))
    cfg[k] = { ...def, ...(raw[k] || {}) };
  for (const k of Object.keys(raw)) if (!(k in cfg)) cfg[k] = raw[k];
  return cfg;
}

/** Đường dẫn tương đối so với gốc dự án, dùng dấu /. */
export function rel(cfg, abs) {
  return path.relative(cfg.root, abs).split(path.sep).join("/");
}
