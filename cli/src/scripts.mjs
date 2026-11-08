// @ts-check
// Script sinh từ TC: chọn feature cần sinh (plan-gen), kiểm script khớp TC (check-script),
// kiểm Claude chỉ ghi vào chỗ được phép (check-paths), cập nhật hash sau khi sửa tay (rehash).
// Xem docs/03-script-generation.md.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { rel, TafError } from "./config.mjs";
import { matchesAny } from "./detect.mjs";
import { lintTestcase, parseTestcase, testcasePath } from "./testcase.mjs";

const SOURCE = /@taf-source\s+(\S+)\s+sha256:([0-9a-f]+)/;
const TEST_TITLE =
  /\btest(?:\.(only|skip|fixme|fail))?\(\s*[`'"](TC-[A-Za-z0-9-]+?-\d{3})\b/g;

/** Hash nội dung TC (bỏ khoảng trắng cuối dòng). Đổi TC → đổi hash → sinh lại script. */
export function tcHash(text) {
  const norm = text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

export function scriptPath(cfg, feature) {
  if (!cfg.scripts.dir)
    throw new TafError("taf.config.yml chưa khai scripts.dir");
  return path.join(cfg.root, cfg.scripts.dir, `${feature}${cfg.scripts.ext}`);
}

/** Dòng đầu script phải có: // @taf-source <TC> sha256:<hash> */
export function sourceHeader(cfg, feature) {
  const tc = testcasePath(cfg, feature);
  return `// @taf-source ${rel(cfg, tc)} sha256:${tcHash(fs.readFileSync(tc, "utf8"))}`;
}

export function readSource(text) {
  const m = SOURCE.exec(text);
  return m ? { tc: m[1], hash: m[2] } : null;
}

/**
 * Feature nào cần sinh (lại) script: TC đã duyệt, không lỗi lint, và script chưa có hoặc
 * @taf-source lệch hash TC.
 * @returns {{ feature: string, action: 'new'|'update'|'ok'|'skip', reason: string }[]}
 */
export function planGen(cfg, features) {
  return features.map((feature) => {
    const tc = testcasePath(cfg, feature);
    if (!fs.existsSync(tc))
      return { feature, action: "skip", reason: "chưa có test case" };
    const { parsed, issues } = lintTestcase(cfg, tc);
    if (issues.some((i) => i.level === "error"))
      return { feature, action: "skip", reason: "test case còn lỗi lint" };
    if (parsed.frontmatter?.status !== cfg.labels.approved)
      return { feature, action: "skip", reason: "test case chưa duyệt" };
    const sp = scriptPath(cfg, feature);
    if (!fs.existsSync(sp))
      return { feature, action: "new", reason: "chưa có script" };
    const src = readSource(fs.readFileSync(sp, "utf8"));
    const hash = tcHash(fs.readFileSync(tc, "utf8"));
    if (!src || src.hash !== hash)
      return {
        feature,
        action: "update",
        reason: `test case đã đổi (${src?.hash ?? "không có @taf-source"} → ${hash})`,
      };
    return { feature, action: "ok", reason: "script khớp test case" };
  });
}

/**
 * Kiểm một script: @taf-source khớp TC, mỗi TC (không DEPRECATED) có test, không có test cho
 * TC lạ hoặc DEPRECATED, không có test.only, không chứa mẫu bị cấm (scripts.forbid).
 * @returns {{ file: string, errors: string[], warnings: string[] }}
 */
export function checkScript(cfg, feature) {
  const sp = scriptPath(cfg, feature);
  const file = rel(cfg, sp);
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(sp))
    return { file, errors: ["không có script"], warnings };
  const text = fs.readFileSync(sp, "utf8");
  const tcAbs = testcasePath(cfg, feature);
  if (!fs.existsSync(tcAbs))
    return {
      file,
      errors: [`không có test case ${rel(cfg, tcAbs)}`],
      warnings,
    };
  const tcText = fs.readFileSync(tcAbs, "utf8");
  const src = readSource(text);
  if (!src) errors.push("thiếu dòng // @taf-source <TC> sha256:<hash>");
  else {
    if (src.tc !== rel(cfg, tcAbs))
      errors.push(`@taf-source trỏ ${src.tc}, phải là ${rel(cfg, tcAbs)}`);
    if (src.hash !== tcHash(tcText))
      errors.push(
        `@taf-source lệch: test case đã đổi sau khi sinh script (${src.hash} ≠ ${tcHash(tcText)}) — sinh lại hoặc \`taf rehash\``,
      );
  }
  const { cases } = parseTestcase(cfg, tcText);
  const active = new Set(cases.filter((c) => !c.deprecated).map((c) => c.id));
  const deprecated = new Set(
    cases.filter((c) => c.deprecated).map((c) => c.id),
  );
  const found = new Set();
  for (const m of text.matchAll(TEST_TITLE)) {
    const [, mod, id] = m;
    const line = text.slice(0, m.index).split("\n").length;
    if (mod === "only") errors.push(`dòng ${line}: không được dùng test.only`);
    if (mod === "skip" || mod === "fixme")
      warnings.push(`dòng ${line}: ${id} bị test.${mod}`);
    if (deprecated.has(id))
      errors.push(`dòng ${line}: ${id} đã DEPRECATED, xoá test này`);
    else if (!active.has(id))
      errors.push(`dòng ${line}: ${id} không có trong test case`);
    found.add(id);
  }
  const missing = [...active].filter((id) => !found.has(id));
  if (missing.length) errors.push(`thiếu test cho: ${missing.join(", ")}`);
  const lines = text.split("\n");
  for (const pattern of cfg.scripts.forbid || []) {
    const re = new RegExp(pattern);
    lines.forEach((l, i) => {
      if (!l.trim().startsWith("//") && re.test(l))
        errors.push(`dòng ${i + 1}: chứa mẫu bị cấm /${pattern}/`);
    });
  }
  return { file, errors, warnings };
}

/** Ghi lại hash @taf-source theo TC hiện tại (sau khi người sửa tay script hoặc TC). */
export function rehash(cfg, feature) {
  const sp = scriptPath(cfg, feature);
  if (!fs.existsSync(sp)) throw new TafError(`Không có ${rel(cfg, sp)}`);
  const text = fs.readFileSync(sp, "utf8");
  const header = sourceHeader(cfg, feature);
  const next = SOURCE.test(text)
    ? text.replace(/\/\/\s*@taf-source.*/, header)
    : `${header}\n${text}`;
  fs.writeFileSync(sp, next);
  return header;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/**
 * File đã đổi (so với `base`, mặc định HEAD) kể cả file mới chưa track, đường dẫn tương đối gốc
 * dự án. File nằm ngoài gốc dự án mang tiền tố "../".
 */
export function changedFiles(cfg, base = "HEAD") {
  const top = git(cfg.root, ["rev-parse", "--show-toplevel"]).trim();
  const list = [
    ...git(top, ["diff", "--name-only", base]).split("\n"),
    ...git(top, ["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ].filter(Boolean);
  return [...new Set(list)]
    .map((f) =>
      path.relative(fs.realpathSync(cfg.root), path.join(top, f)).split(path.sep).join("/"),
    )
    .sort();
}

/** File đã đổi mà không nằm trong scripts.allowedPaths. */
export function checkPaths(cfg, base) {
  const files = changedFiles(cfg, base);
  return {
    files,
    outside: files.filter(
      (f) => f.startsWith("../") || !matchesAny(f, cfg.scripts.allowedPaths),
    ),
  };
}

/** Mọi feature đang có script trong scripts.dir. */
export function listScripts(cfg) {
  if (!cfg.scripts.dir) return [];
  const dir = path.join(cfg.root, cfg.scripts.dir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(cfg.scripts.ext))
    .map((f) => f.slice(0, -cfg.scripts.ext.length))
    .sort();
}
