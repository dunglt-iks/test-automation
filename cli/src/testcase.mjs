// @ts-check
// Đọc test case markdown và kiểm tra cú pháp (lint-tc). Định dạng: docs/02-testcase-format.md.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { extractTraces, scopeOf } from "./codes.mjs";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function splitRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

/** Đường dẫn file TC của một feature: <dir>/<scope>/<FEATURE>.md */
export function testcasePath(cfg, featureCode) {
  return path.join(
    cfg.root,
    cfg.testcases.dir,
    scopeOf(cfg, featureCode),
    `${featureCode}.md`,
  );
}

export function parseTestcase(cfg, text) {
  const L = cfg.labels;
  const OUT_OF_SCOPE = new RegExp(`^##\\s+${esc(L.outOfScope)}\\s*$`);
  const FIELD = new RegExp(
    `^-\\s+(${[L.trace, L.persona, L.screens, L.priority].map(esc).join("|")})\\s*:\\s*(.*)$`,
  );
  const lines = text.split("\n");
  let fm = null;
  let fmError = null;
  let body = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end < 0) fmError = "Frontmatter không có dòng --- đóng";
    else {
      try {
        fm = YAML.parse(lines.slice(1, end).join("\n")) || {};
        // Hash hex toàn chữ số (hoặc dạng 1e5…) bị YAML đọc thành số: lấy nguyên văn.
        const raw = lines
          .slice(1, end)
          .map((l) => /^specHash:\s*["']?([0-9a-fA-F]*)["']?\s*(#.*)?$/.exec(l))
          .find(Boolean);
        if (raw) fm.specHash = raw[1];
      } catch (e) {
        fmError = `Frontmatter sai YAML: ${e.message}`;
      }
      body = end + 1;
    }
  } else fmError = "Thiếu frontmatter (--- ở dòng đầu)";

  const cases = [];
  const outOfScope = [];
  let cur = null;
  let inOut = false;
  let tableHeader = null;
  for (let i = body; i < lines.length; i++) {
    const line = lines[i];
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      tableHeader = null;
      if (OUT_OF_SCOPE.test(line)) {
        inOut = true;
        cur = null;
        continue;
      }
      inOut = false;
      const tc = /^(TC-\S+)\s*(?:·\s*(.*))?$/.exec(h2[1].trim());
      cur = tc
        ? {
            id: tc[1],
            title: (tc[2] || "").trim(),
            line: i + 1,
            deprecated: /\[DEPRECATED\]/.test(h2[1]),
            traces: [],
            screens: [],
            persona: null,
            priority: null,
            hasExpected: false,
          }
        : null;
      if (cur) cases.push(cur);
      continue;
    }
    if (inOut) {
      if (!line.trim().startsWith("|")) continue;
      const cells = splitRow(line);
      if (cells[0] === L.code || /^-+$/.test(cells[0].replace(/:/g, "")))
        continue;
      for (const code of extractTraces(cfg, cells[0]))
        outOfScope.push({
          code,
          reason: cells[1] || "",
          where: cells[2] || "",
          line: i + 1,
        });
      continue;
    }
    if (!cur) continue;
    const field = FIELD.exec(line.trim());
    if (field) {
      const v = field[2].trim();
      if (field[1] === L.trace)
        cur.traces.push(
          ...extractTraces(cfg, v).filter((c) => !cur.traces.includes(c)),
        );
      else if (field[1] === L.screens)
        cur.screens.push(...extractTraces(cfg, v));
      else if (field[1] === L.persona)
        cur.persona = v.replace(/`/g, "") || null;
      else cur.priority = v || null;
      continue;
    }
    if (line.trim().startsWith("|")) {
      if (!tableHeader) {
        tableHeader = splitRow(line);
        if (tableHeader.includes(L.expected)) cur.hasExpected = true;
      }
    } else tableHeader = null;
  }
  return { frontmatter: fm, fmError, cases, outOfScope };
}

/** Tên persona hợp lệ từ testcases.personas (map YAML → các khoá, danh sách → các phần tử). */
export function loadPersonaNames(cfg) {
  const p = cfg.testcases.personas;
  if (!p) return null;
  const abs = path.join(cfg.root, p);
  if (!fs.existsSync(abs)) return null;
  const data = YAML.parse(fs.readFileSync(abs, "utf8")) || {};
  return Array.isArray(data) ? data.map(String) : Object.keys(data);
}

/**
 * Kiểm tra cú pháp một file TC.
 * @returns {{ parsed: any, issues: {level: 'error'|'warn', line: number, msg: string}[] }}
 */
export function lintTestcase(cfg, file) {
  const text = fs.readFileSync(file, "utf8");
  const parsed = parseTestcase(cfg, text);
  const issues = [];
  const err = (line, msg) => issues.push({ level: "error", line, msg });
  const warn = (line, msg) => issues.push({ level: "warn", line, msg });
  const fm = parsed.frontmatter;
  if (parsed.fmError) err(1, parsed.fmError);
  const personas = loadPersonaNames(cfg);
  const L = cfg.labels;
  const STATUSES = [L.draft, L.approved];
  const personaFile = cfg.testcases.personas;
  const feature = fm?.feature;
  if (fm) {
    if (!feature) err(1, 'Frontmatter thiếu "feature"');
    else if (!new RegExp(`^(?:${cfg.adapter.featureRegex().source})$`).test(feature))
      err(1, `"feature: ${feature}" không đúng mẫu mã feature`);
    else if (path.basename(file, ".md") !== feature)
      err(1, `Tên file phải là ${feature}.md`);
    if (!fm.spec) err(1, 'Frontmatter thiếu "spec"');
    else if (!fs.existsSync(path.join(cfg.root, fm.spec)))
      warn(1, `Không thấy file spec ${fm.spec}`);
    if (!STATUSES.includes(fm.status))
      err(1, `"status" phải là ${STATUSES.join(" hoặc ")}`);
    if (fm.status === L.approved) {
      if (!fm.reviewer) err(1, `TC ${L.approved} phải có "reviewer"`);
      if (!fm.specHash) err(1, `TC ${L.approved} phải có "specHash"`);
    } else if (!fm.specHash)
      warn(1, 'Chưa có "specHash" — chạy `taf spec <mã> --hash` để lấy');
    if (fm.persona && personas && !personas.includes(fm.persona))
      err(1, `Persona "${fm.persona}" không có trong ${personaFile}`);
  }
  if (parsed.cases.length === 0)
    err(1, 'Không có test case nào (heading "## TC-…")');
  const seen = new Set();
  const scope = feature ? scopeOf(cfg, feature) : null;
  for (const c of parsed.cases) {
    if (feature && !new RegExp(`^TC-${feature}-\\d{3}$`).test(c.id))
      err(c.line, `Mã "${c.id}" phải dạng TC-${feature}-### (3 chữ số)`);
    if (seen.has(c.id)) err(c.line, `Mã "${c.id}" bị trùng`);
    seen.add(c.id);
    if (c.deprecated) continue;
    if (!c.title) warn(c.line, `${c.id}: thiếu tên sau dấu ·`);
    if (c.traces.length === 0)
      err(c.line, `${c.id}: thiếu dòng "- ${L.trace}:" có mã spec`);
    for (const t of c.traces) {
      if (feature && !t.startsWith(feature) && !t.startsWith(`${scope}-`))
        warn(c.line, `${c.id}: mã truy vết ${t} không thuộc ${feature}`);
    }
    if (!c.hasExpected)
      err(c.line, `${c.id}: thiếu bảng có cột "${L.expected}"`);
    if (c.persona && personas && !personas.includes(c.persona))
      err(
        c.line,
        `${c.id}: persona "${c.persona}" không có trong ${personaFile}`,
      );
    if (!c.persona && !fm?.persona)
      warn(c.line, `${c.id}: không có persona (cả TC lẫn frontmatter)`);
  }
  return { parsed, issues };
}
