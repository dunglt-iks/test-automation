// @ts-check
// Đọc taf.config.yml của dự án và điền giá trị mặc định. Xem docs/01-architecture.md §3.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";
import { resolveLabels } from "./labels.mjs";

import { TafError } from "./errors.mjs";

export { TafError };

const DEFAULTS = {
  spec: {
    adapter: "prd-fsd", // tên adapter có sẵn trong adapters/spec/, hoặc đường dẫn ./x.mjs của dự án
    roots: ["docs/features"],
    featurePattern: "(?:[A-Z]{2,4}|CORE-C\\d{2})-F\\d{2}",
    normalize: [],
    approvedValue: "Đã duyệt",
  },
  testcases: {
    dir: "e2e/testcases",
    labels: "vi", // vi | en | { base: vi, ...ghi đè }
    personas: null, // tuỳ chọn: file liệt kê tên persona hợp lệ (map YAML hoặc danh sách)
  },
  scripts: {
    dir: "e2e/scripts", // nơi đặt script sinh ra: <dir>/<FEATURE><ext>
    ext: ".spec.mjs",
    guide: null, // hướng dẫn viết test của dự án, Claude đọc khi sinh script
    allowedPaths: ["e2e/testcases/**", "e2e/scripts/**", "e2e/pages/**"], // Claude chỉ được ghi vào đây
    forbid: [], // regex cấm xuất hiện trong script sinh ra (vd locator ngoài page object)
    lint: null, // lệnh kiểm của dự án sau khi sinh (vd tsc --noEmit)
    verifyTarget: null, // target để Claude chạy thử script vừa sinh (tuỳ chọn)
  },
  run: {
    targets: {}, // <tên>: { start?, stop?, test, logs?: [] }
    report: "e2e/test-results/results.json", // JSON report của Playwright (TAF đặt PLAYWRIGHT_JSON_OUTPUT_NAME)
  },
  trigger: {
    codePaths: [],
    statusFile: null, // tuỳ chọn: dòng feature đổi sang statusDone → PR có feature đó
    statusDone: ["Hoàn thành"],
    skipLabel: "e2e-skip",
  },
  gate: { blockedLabel: "e2e-blocked" },
  tracker: { adapter: "github", labels: ["bug", "e2e"] },
};

/** Vị trí file cấu hình, tìm theo thứ tự (gốc repo là bản cũ v1.0, vẫn đọc được). */
export const CONFIG_FILES = ["e2e/taf.config.yml", "taf.config.yml"];

/** @param {string} root @returns {string|null} */
export function findConfig(root) {
  for (const f of CONFIG_FILES)
    if (fs.existsSync(path.join(root, f))) return path.join(root, f);
  return null;
}

/**
 * Mọi đường dẫn trong cấu hình tính từ gốc dự án (`root`), không phải từ thư mục chứa file cấu hình.
 * @param {{ root?: string, config?: string }} [opts]
 */
export function loadConfig(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const file = opts.config ? path.resolve(opts.config) : findConfig(root);
  if (!file || !fs.existsSync(file))
    throw new TafError(
      `Không thấy file cấu hình ${file || CONFIG_FILES.map((f) => path.join(root, f)).join(" hoặc ")}`,
    );
  const raw = YAML.parse(fs.readFileSync(file, "utf8")) || {};
  if (raw.version !== 1) throw new TafError(`${file}: chỉ hỗ trợ version: 1`);
  /** @type {any} */
  const cfg = { root, file };
  for (const [k, def] of Object.entries(DEFAULTS))
    cfg[k] = { ...def, ...(raw[k] || {}) };
  for (const k of Object.keys(raw)) if (!(k in cfg)) cfg[k] = raw[k];
  // Tên cũ (v0.1): scripts.personas → testcases.personas
  cfg.testcases.personas ??= cfg.scripts.personas ?? null;
  cfg.labels = resolveLabels(cfg.testcases.labels);
  return cfg;
}

/**
 * Nạp cấu hình + spec adapter. Mọi lệnh dùng hàm này; cfg.adapter là adapter đã tạo.
 * @param {{ root?: string, config?: string }} [opts]
 */
export async function loadProject(opts = {}) {
  const cfg = loadConfig(opts);
  cfg.adapter = await loadSpecAdapter(cfg);
  return cfg;
}

const BUILTIN = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../adapters",
);

/** Nạp module adapter: tên có sẵn trong adapters/<kind>/ hoặc đường dẫn tương đối gốc dự án. */
export async function importAdapter(cfg, kind, name) {
  const file =
    name.startsWith(".") || name.startsWith("/")
      ? path.resolve(cfg.root, name)
      : path.join(BUILTIN, kind, `${name}.mjs`);
  if (!fs.existsSync(file))
    throw new TafError(`Không thấy ${kind} adapter "${name}" (${file})`);
  return import(pathToFileURL(file).href);
}

async function loadSpecAdapter(cfg) {
  const mod = await importAdapter(cfg, "spec", cfg.spec.adapter);
  if (typeof mod.createSpecAdapter !== "function")
    throw new TafError(
      `Spec adapter "${cfg.spec.adapter}" phải export createSpecAdapter(cfg)`,
    );
  const a = mod.createSpecAdapter(cfg);
  for (const fn of [
    "findFeature",
    "listFeatures",
    "requiredCodes",
    "scopeOf",
    "featureRegex",
    "traceRegex",
  ])
    if (typeof a[fn] !== "function")
      throw new TafError(`Spec adapter "${cfg.spec.adapter}" thiếu ${fn}()`);
  return a;
}

/** Đường dẫn tương đối so với gốc dự án, dùng dấu /. */
export function rel(cfg, abs) {
  return path.relative(cfg.root, abs).split(path.sep).join("/");
}
