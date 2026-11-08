// @ts-check
// Gate: một feature chỉ qua khi có TC đã duyệt, không lỗi thời và phủ đủ US/A/E/SCR.
// Xem docs/02-testcase-format.md §3–4 và docs/04-ci-workflow.md §2.
import fs from "node:fs";
import { rel } from "./config.mjs";
import { lintTestcase, testcasePath } from "./testcase.mjs";
import { requiredCodes } from "../../adapters/spec/prd-fsd.mjs";

/**
 * @returns {{ code: string, ok: boolean, skipped?: string, problems: string[], warnings: string[],
 *   tcFile: string, coverage?: { required: number, covered: number, missing: string[] } }}
 */
export function gateFeature(cfg, adapter, code) {
  const problems = [];
  const warnings = [];
  const tcAbs = testcasePath(cfg, code);
  const tcFile = rel(cfg, tcAbs);
  const feature = adapter.findFeature(code);
  if (!feature)
    return {
      code,
      ok: false,
      problems: [`Không tìm thấy spec của ${code}`],
      warnings,
      tcFile,
    };
  if (feature.deprecated)
    return {
      code,
      ok: true,
      skipped: "Feature [DEPRECATED]",
      problems,
      warnings,
      tcFile,
    };
  if (!feature.approved)
    problems.push(
      `Spec chưa duyệt (Spec: ${feature.status ?? "không rõ"} trong ${feature.statusFile ?? "PRD"})`,
    );
  if (!fs.existsSync(tcAbs)) {
    problems.push(
      `Chưa có test case \`${tcFile}\` — chạy \`/testcase ${code}\``,
    );
    return { code, ok: false, problems, warnings, tcFile };
  }
  const { parsed, issues } = lintTestcase(cfg, tcAbs);
  for (const i of issues)
    (i.level === "error" ? problems : warnings).push(
      `${tcFile}:${i.line} ${i.msg}`,
    );
  const fm = parsed.frontmatter || {};
  if (fm.status && fm.status !== "Đã duyệt")
    problems.push(
      `Test case còn ${fm.status} — người review đổi \`status: Đã duyệt\``,
    );
  if (fm.specHash && fm.specHash !== feature.hash) {
    problems.push(
      `Test case lỗi thời: spec đã đổi sau khi viết TC (specHash ${fm.specHash} ≠ ${feature.hash}) — cập nhật TC rồi duyệt lại`,
    );
  }
  const covered = new Set();
  for (const c of parsed.cases) {
    if (c.deprecated) continue;
    c.traces.forEach((t) => covered.add(t));
    c.screens.forEach((t) => covered.add(t));
  }
  parsed.outOfScope.forEach((o) => covered.add(o.code));
  const required = requiredCodes(feature);
  const missing = required.filter((r) => !covered.has(r));
  if (missing.length)
    problems.push(
      `Chưa phủ ${missing.length}/${required.length} mã: ${missing.join(", ")}`,
    );
  const known = new Set(required);
  for (const t of covered) {
    if (/-(US|SCR)\d{2}/.test(t) && t.startsWith(code) && !known.has(t))
      warnings.push(
        `Mã ${t} không có trong spec hiện tại (đã bỏ hoặc gõ sai?)`,
      );
  }
  return {
    code,
    ok: problems.length === 0,
    problems,
    warnings,
    tcFile,
    coverage: {
      required: required.length,
      covered: required.length - missing.length,
      missing,
    },
  };
}

export function gate(cfg, adapter, codes) {
  const results = codes.map((c) => gateFeature(cfg, adapter, c));
  return { ok: results.every((r) => r.ok), results };
}

export const GATE_MARKER = "<!-- taf:gate -->";

export function gateMarkdown(report) {
  const head = report.ok
    ? "## E2E-TAF · Gate ✓"
    : "## E2E-TAF · Gate ✘ — chưa đủ test case";
  const rows = report.results.map((r) => {
    const cov = r.coverage
      ? `${r.coverage.covered}/${r.coverage.required}`
      : "—";
    const st = r.skipped ? `bỏ qua (${r.skipped})` : r.ok ? "✓" : "✘";
    return `| ${r.code} | ${st} | ${cov} | \`${r.tcFile}\` |`;
  });
  const details = report.results
    .filter((r) => r.problems.length || r.warnings.length)
    .map((r) => {
      const p = r.problems.map((x) => `- ✘ ${x}`);
      const w = r.warnings.map((x) => `- ⚠ ${x}`);
      return `### ${r.code}\n${[...p, ...w].join("\n")}`;
    });
  const tail = report.ok
    ? ""
    : "\n\n> PR này **không được merge** khi còn nhãn `e2e-blocked` (repo chưa bật required check, đây là chặn mềm).";
  return (
    [
      GATE_MARKER,
      head,
      "",
      "| Feature | Gate | Phủ | Test case |",
      "|---|---|---|---|",
      ...rows,
      "",
      ...details,
    ].join("\n") +
    tail +
    "\n"
  );
}

export function gateText(report) {
  const out = [];
  for (const r of report.results) {
    const cov = r.coverage
      ? ` phủ ${r.coverage.covered}/${r.coverage.required}`
      : "";
    out.push(
      `${r.ok ? "✓" : "✘"} ${r.code}${r.skipped ? ` (bỏ qua: ${r.skipped})` : ""}${cov}`,
    );
    r.problems.forEach((p) => out.push(`    ✘ ${p}`));
    r.warnings.forEach((w) => out.push(`    ⚠ ${w}`));
  }
  out.push(report.ok ? "Gate: QUA" : "Gate: KHÔNG QUA");
  return out.join("\n");
}
