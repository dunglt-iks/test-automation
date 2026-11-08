// @ts-check
// Spec adapter "prd-fsd": đọc spec dạng PRD + FSD (định dạng của app-base, xem .claude/templates/fsd.md ở đó).
//
// - Feature: heading cấp 1–3 trong file FSD (FSD-*.md hoặc file trong thư mục FSD-*/), dạng
//   "## 7. DL-F05 — Tên". Phần của feature kéo tới heading kế tiếp cùng cấp hoặc cao hơn.
// - Màn hình: heading "#### DL-F05-SCR01". Luồng: heading "#### DL-F05-US01"; nhánh là dòng
//   "- **A1 — …**" / "- **E1 — …**" trong phần của luồng đó.
// - Trạng thái duyệt: cột "Spec" của bảng Feature Summary trong PRD-*.md cùng thư mục addon/capability.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { rel } from "../../cli/src/config.mjs";

const HEADING = /^(#{1,6})\s+(.*)$/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function isFsdFile(relPath) {
  return /(^|\/)FSD-[^/]+(\.md$|\/)/.test(relPath);
}

/** Hash của phần spec: bỏ khoảng trắng cuối dòng và dòng trống đầu/cuối. */
export function hashText(text) {
  const norm = text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

function sectionEnd(lines, start, level) {
  for (let i = start + 1; i < lines.length; i++) {
    const m = HEADING.exec(lines[i]);
    if (m && m[1].length <= level) return i;
  }
  return lines.length;
}

/** Phần mở đầu của feature: từ heading tới heading con đầu tiên (tối đa 10 dòng). */
function introOf(lines, start) {
  const out = [lines[start]];
  for (let i = start + 1; i < Math.min(lines.length, start + 10); i++) {
    if (HEADING.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

function parseFeatureSection(code, lines, start, end) {
  const screens = [];
  const stories = [];
  const escaped = code.replace(/[-]/g, "\\-");
  const scrRe = new RegExp(`^(#{2,6})\\s+(${escaped}-SCR\\d{2})\\b(.*)$`);
  const usRe = new RegExp(`^(#{2,6})\\s+(${escaped}-US\\d{2})\\b(.*)$`);
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    const scr = scrRe.exec(line);
    if (scr) {
      const e = sectionEnd(lines, i, scr[1].length);
      const head = lines.slice(i, Math.min(e, i + 4)).join("\n");
      screens.push({ code: scr[2], deprecated: /\[DEPRECATED\]/.test(head) });
      continue;
    }
    const us = usRe.exec(line);
    if (!us) continue;
    const e = Math.min(sectionEnd(lines, i, us[1].length), end);
    const block = lines.slice(i, e);
    // Tên luồng: dòng không rỗng đầu tiên sau heading (thường là "**Tên**").
    const titleLine = block.slice(1).find((l) => l.trim() !== "");
    const branches = [];
    for (const l of block) {
      const b = /^\s*-\s+\*\*([AE]\d+)\b/.exec(l);
      if (b && !branches.includes(`${us[2]}-${b[1]}`))
        branches.push(`${us[2]}-${b[1]}`);
    }
    stories.push({
      code: us[2],
      title:
        titleLine && !/^[-|>#]/.test(titleLine.trim())
          ? titleLine.replace(/\*\*/g, "").trim()
          : us[3].replace(/^[\s—-]+/, ""),
      line: i + 1,
      deprecated: /\[DEPRECATED\]/.test(block.slice(0, 4).join("\n")),
      branches,
    });
  }
  return { screens, stories };
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim().replace(/\*\*/g, ""));
}

/** Đọc cột "Spec" của dòng mã feature trong PRD-*.md ở thư mục addon/capability. */
function readStatus(fsdAbs, code) {
  let dir = path.dirname(fsdAbs);
  if (/^FSD-/.test(path.basename(dir))) dir = path.dirname(dir);
  const prd = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => /^PRD-.+\.md$/.test(f))
    : null;
  if (!prd) return { status: null, prd: null };
  const prdAbs = path.join(dir, prd);
  const lines = fs.readFileSync(prdAbs, "utf8").split("\n");
  let specCol = -1;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      specCol = -1;
      continue;
    }
    const cells = splitRow(line);
    if (specCol < 0) {
      const idx = cells.findIndex((c) => c === "Spec");
      if (idx > 0 && /^(Code|Mã)$/.test(cells[0])) specCol = idx;
      continue;
    }
    if (cells[0] === code)
      return { status: cells[specCol] || null, prd: prdAbs };
  }
  return { status: null, prd: prdAbs };
}

export function createSpecAdapter(cfg) {
  /** @type {Map<string, any>} */
  let index = null;

  function build() {
    index = new Map();
    const featHead = new RegExp(
      `^(#{1,3})\\s+.*?(?<![A-Z0-9-])(${cfg.spec.featurePattern})\\s+[—–-]\\s+(.+)$`,
    );
    for (const root of cfg.spec.roots) {
      for (const abs of walk(path.join(cfg.root, root))) {
        const r = rel(cfg, abs);
        if (!isFsdFile(r)) continue;
        const lines = fs.readFileSync(abs, "utf8").split("\n");
        lines.forEach((line, i) => {
          const m = featHead.exec(line);
          if (!m || /-(US|SCR)\d{2}/.test(line)) return;
          const code = m[2];
          if (index.has(code)) return;
          const end = sectionEnd(lines, i, m[1].length);
          const text = lines.slice(i, end).join("\n");
          index.set(code, {
            code,
            name: m[3].trim(),
            abs,
            file: r,
            line: i + 1,
            start: i,
            end,
            lines,
            text,
          });
        });
      }
    }
  }

  function findFeature(code) {
    if (!index) build();
    const raw = index.get(code);
    if (!raw) return null;
    if (!raw.parsed) {
      const { screens, stories } = parseFeatureSection(
        code,
        raw.lines,
        raw.start,
        raw.end,
      );
      const { status, prd } = readStatus(raw.abs, code);
      raw.parsed = {
        code,
        name: raw.name,
        file: raw.file,
        line: raw.line,
        deprecated: /\[DEPRECATED\]/.test(introOf(raw.lines, raw.start)),
        status,
        approved: status === cfg.spec.approvedValue,
        statusFile: prd ? rel(cfg, prd) : null,
        hash: hashText(raw.text),
        screens,
        stories,
        text: raw.text,
      };
    }
    return raw.parsed;
  }

  function listFeatures() {
    if (!index) build();
    return [...index.keys()].sort();
  }

  return { findFeature, listFeatures };
}

/** Các mã một feature bắt buộc phải có test case phủ (bỏ phần DEPRECATED). */
export function requiredCodes(feature) {
  const out = [];
  for (const s of feature.stories) {
    if (s.deprecated) continue;
    out.push(s.code, ...s.branches);
  }
  for (const s of feature.screens) if (!s.deprecated) out.push(s.code);
  return out;
}
