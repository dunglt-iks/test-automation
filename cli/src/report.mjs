// @ts-check
// taf report: đọc JSON report của Playwright → kết quả theo feature (phủ spec, TC, pass/fail),
// danh sách lỗi có fingerprint, taf-result.json, comment PR. Xem docs/07-bug-reporting.md.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { extractFeatures, extractTraces } from "./codes.mjs";
import { rel, TafError } from "./config.mjs";
import { gateFeature } from "./gate.mjs";
import { parseTestcase, testcasePath } from "./testcase.mjs";

export const REPORT_MARKER = "<!-- taf:report -->";
const ANSI = /\u001b\[[0-9;]*m/g;
const TC_ID = /^(TC-(.+?)-\d{3})(?!\d)/;

/** Bỏ màu, giữ phần đầu thông báo lỗi (trước "Call log"). */
export function cleanError(msg) {
  return String(msg || "")
    .replace(ANSI, "")
    .split(/\n\s*Call log:/)[0]
    .trim();
}

/**
 * Chữ ký lỗi để chống trùng bug: các dòng đầu (Error/Locator/Expected), bỏ phần thay đổi
 * giữa các lần chạy (giá trị Received, mã đơn #12, thời gian, id ngẫu nhiên).
 */
export function errorSignature(msg) {
  return cleanError(msg)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^(Error|Locator|Expected)\b/.test(l))
    .map((l) => (l.startsWith("Locator") ? l.replace(/\d+/g, "N") : l))
    .join(" | ")
    .replace(/#\d+/g, "#N")
    .replace(/\b\d+ms\b/g, "Nms")
    .replace(/\b[0-9a-f]{12,}\b/gi, "H")
    .replace(/E2E [^"'\s]*\s?[a-z0-9]{6,}/g, "E2E …");
}

export function fingerprint(key, msg) {
  return crypto
    .createHash("sha1")
    .update(`${key}|${errorSignature(msg)}`)
    .digest("hex")
    .slice(0, 12);
}

/**
 * Danh sách test phẳng từ JSON report của Playwright.
 * @returns {{ title: string, fullTitle: string, file: string, line: number, project: string,
 *   outcome: 'passed'|'failed'|'flaky'|'skipped', error: string, attachments: {name: string, path?: string}[] }[]}
 */
export function flattenResults(json) {
  const out = [];
  const walk = (suite, parents) => {
    for (const spec of suite.specs || [])
      for (const t of spec.tests || []) {
        // Lỗi đã biết: test.fail() (expectedStatus "failed"). Fail đúng như dự kiến → "known";
        // lại pass → "failed" kèm knownFixed (app có thể đã sửa — gỡ dấu lỗi đã biết).
        const expectFail = t.expectedStatus === "failed";
        const note =
          (t.annotations || []).find((a) => a.type === "fail")?.description || "";
        const outcome = expectFail
          ? t.status === "expected"
            ? "known"
            : t.status === "skipped"
              ? "skipped"
              : "failed"
          : {
              expected: "passed",
              unexpected: "failed",
              flaky: "flaky",
              skipped: "skipped",
            }[t.status] || "failed";
        const knownFixed = expectFail && outcome === "failed";
        const failed = (t.results || []).filter(
          (r) => r.status !== "passed" && r.status !== "skipped",
        );
        const last = failed[failed.length - 1];
        out.push({
          title: spec.title,
          fullTitle: [...parents, spec.title].filter(Boolean).join(" › "),
          file: spec.file,
          line: spec.line,
          project: t.projectName,
          outcome,
          error: knownFixed
            ? `Test đánh dấu lỗi đã biết nhưng đã pass — app có thể đã sửa, gỡ dấu lỗi đã biết${note ? ` (${note})` : ""}`
            : last
              ? cleanError(last.error?.message || last.errors?.[0]?.message)
              : "",
          note,
          knownFixed,
          attachments: (last?.attachments || []).map((a) => ({
            name: a.name,
            path: a.path,
          })),
        });
      }
    for (const s of suite.suites || []) walk(s, [...parents, s.title]);
  };
  for (const s of json.suites || []) walk(s, []);
  return out;
}

export function loadResults(file) {
  if (!fs.existsSync(file))
    throw new TafError(`Không thấy JSON report ${file} — chạy taf run trước`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * @param {any} cfg
 * @param {{ results: any, features?: string[], target?: string }} o
 */
export function buildReport(cfg, o) {
  const tests = flattenResults(o.results).map((t) => {
    const m = TC_ID.exec(t.title);
    const tc = m ? m[1] : null;
    const feature = m ? m[2] : extractFeatures(cfg, t.title)[0] || null;
    return {
      ...t,
      tc,
      feature,
      generated: Boolean(m),
      traces: m ? [] : extractTraces(cfg, t.title),
      fingerprint:
        t.outcome === "failed" ? fingerprint(tc || t.title, t.error) : null,
    };
  });
  const features = [
    ...new Set([
      ...(o.features || []),
      ...tests.map((t) => t.feature).filter(Boolean),
    ]),
  ].sort();
  const rows = features.map((code) => {
    const mine = tests.filter((t) => t.feature === code);
    const gen = mine.filter((t) => t.generated);
    const other = mine.filter((t) => !t.generated);
    const count = (list, o) => list.filter((t) => t.outcome === o).length;
    const feature = cfg.adapter.findFeature(code);
    const tcFile = testcasePath(cfg, code);
    let tcs = null;
    let coverage = null;
    if (fs.existsSync(tcFile)) {
      const parsed = parseTestcase(cfg, fs.readFileSync(tcFile, "utf8"));
      const active = parsed.cases.filter((c) => !c.deprecated).map((c) => c.id);
      const run = new Set(gen.map((t) => t.tc));
      tcs = {
        total: active.length,
        withTest: active.filter((id) => run.has(id)).length,
        notRun: active.filter((id) => !run.has(id)),
        status: parsed.frontmatter?.status ?? null,
      };
    }
    if (feature) coverage = gateFeature(cfg, code).coverage || null;
    return {
      feature: code,
      name: feature?.name ?? null,
      coverage,
      testcases: tcs,
      generated: {
        total: gen.length,
        passed: count(gen, "passed"),
        failed: count(gen, "failed"),
        flaky: count(gen, "flaky"),
        skipped: count(gen, "skipped"),
        known: count(gen, "known"),
      },
      other: {
        total: other.length,
        passed: count(other, "passed"),
        failed: count(other, "failed"),
      },
    };
  });
  const s = o.results.stats || {};
  return {
    version: 1,
    target: o.target || process.env.TAF_TARGET || null,
    commit: process.env.GITHUB_SHA || null,
    run: process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
    createdAt: new Date().toISOString(),
    totals: {
      tests: tests.length,
      passed: tests.filter((t) => t.outcome === "passed").length,
      failed: tests.filter((t) => t.outcome === "failed").length,
      flaky: tests.filter((t) => t.outcome === "flaky").length,
      skipped: tests.filter((t) => t.outcome === "skipped").length,
      known: tests.filter((t) => t.outcome === "known").length,
      durationMs: Math.round(s.duration || 0),
    },
    features: rows,
    failures: tests
      .filter((t) => t.outcome === "failed")
      .map(
        ({
          title,
          file,
          line,
          tc,
          feature,
          error,
          fingerprint: fp,
          attachments,
          knownFixed,
        }) => ({
          title,
          file,
          line,
          tc,
          feature,
          error,
          fingerprint: fp,
          attachments,
          ...(knownFixed ? { knownFixed: true } : {}),
        }),
      ),
    known: tests
      .filter((t) => t.outcome === "known")
      .map(({ title, file, line, tc, feature, note }) => ({ title, file, line, tc, feature, note })),
    flaky: tests.filter((t) => t.outcome === "flaky").map((t) => t.title),
    tests: tests.map(({ title, file, line, tc, feature, outcome }) => ({
      title,
      file,
      line,
      tc,
      feature,
      outcome,
    })),
  };
}

/** Gắn kết quả triage (triage.json cạnh run.report, do AI ghi) vào từng lỗi. */
export function applyTriage(report, triage) {
  const byTitle = new Map((triage || []).map((t) => [t.test, t]));
  for (const f of report.failures) {
    const t = byTitle.get(f.title);
    f.triage = t ? { class: t.class, summary: t.summary || "" } : null;
  }
  return report;
}

const pct = (a, b) => (b ? `${a}/${b}` : "—");

export function reportMarkdown(report, extra = {}) {
  const t = report.totals;
  const known = t.known ? ` · ${t.known} lỗi đã biết` : "";
  const head =
    t.failed > 0
      ? `## E2E-TAF · ✘ ${t.failed} test fail · ${t.passed}/${t.tests} pass${known}`
      : `## E2E-TAF · ✓ ${t.passed}/${t.tests} pass${known}`;
  const lines = [REPORT_MARKER, head, ""];
  if (report.target)
    lines.push(
      `Target: \`${report.target}\`${report.run ? ` · [run](${report.run})` : ""}`,
      "",
    );
  lines.push(
    "| Feature | Phủ spec | TC có test | Script (pass/fail/flaky/đã biết) | Test khác |",
    "|---|---|---|---|---|",
  );
  for (const r of report.features) {
    const g = r.generated;
    const st = g.total
      ? `${g.passed}/${g.failed}/${g.flaky}/${g.known || 0}${g.failed ? " ✘" : " ✓"}`
      : "—";
    const o = r.other.total
      ? `${r.other.passed}/${r.other.total}${r.other.failed ? " ✘" : ""}`
      : "—";
    lines.push(
      `| ${r.feature}${r.name ? ` ${r.name}` : ""} | ${r.coverage ? pct(r.coverage.covered, r.coverage.required) : "—"} | ${r.testcases ? pct(r.testcases.withTest, r.testcases.total) : "chưa có TC"} | ${st} | ${o} |`,
    );
  }
  if (report.failures.length) {
    lines.push("", "### Test fail", "");
    for (const f of report.failures) {
      const cls = f.triage
        ? ` — **${f.triage.class}**${f.triage.summary ? `: ${f.triage.summary}` : ""}`
        : "";
      const issue = extra.issues?.[f.fingerprint]
        ? ` · #${extra.issues[f.fingerprint]}`
        : "";
      lines.push(
        `<details><summary>${f.title}${cls}${issue}</summary>\n\n\`${f.file}:${f.line}\`\n\n\`\`\`\n${f.error.split("\n").slice(0, 8).join("\n")}\n\`\`\`\n</details>`,
      );
    }
  }
  if (report.known?.length) {
    lines.push(
      "",
      "### Lỗi đã biết",
      "",
      "Test kiểm đúng TC, fail đúng như dự kiến vì lỗi app đang chờ sửa (`test.fail`). Không tính là pass hay fail.",
      "",
    );
    for (const k of report.known)
      lines.push(`- ${k.title}${k.note ? ` — ${linkify(k.note)}` : ""}`);
  }
  if (report.flaky.length)
    lines.push(
      "",
      `⚠ Flaky (pass ở lần chạy lại): ${report.flaky.join("; ")}`,
    );
  const notRun = report.features.flatMap((r) =>
    (r.testcases?.notRun || []).map((id) => id),
  );
  if (notRun.length)
    lines.push("", `TC chưa có test chạy: ${notRun.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

/** Link issue GitHub dạng ngắn #N trong comment. */
function linkify(s) {
  return s.replace(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)/g, (u, n) => `[#${n}](${u})`);
}

export function reportText(report) {
  const t = report.totals;
  const out = [
    `${t.passed}/${t.tests} pass, ${t.failed} fail, ${t.flaky} flaky, ${t.skipped} skip${t.known ? `, ${t.known} lỗi đã biết` : ""}`,
  ];
  for (const r of report.features) {
    const g = r.generated;
    out.push(
      `  ${r.feature}: phủ spec ${r.coverage ? pct(r.coverage.covered, r.coverage.required) : "—"}, TC có test ${r.testcases ? pct(r.testcases.withTest, r.testcases.total) : "—"}, script ${g.passed}✓ ${g.failed}✘ ${g.flaky}~${g.known ? ` ${g.known}⊘` : ""}, test khác ${r.other.passed}/${r.other.total}`,
    );
  }
  for (const k of report.known || [])
    out.push(`  ⊘ ${k.title}${k.note ? ` — ${k.note}` : ""}`);
  for (const f of report.failures)
    out.push(
      `  ✘ ${f.title} [${f.fingerprint}]${f.triage ? ` — ${f.triage.class}` : ""}\n      ${f.error.split("\n")[0]}`,
    );
  return out.join("\n");
}

export function resultPath(cfg) {
  return path.join(
    path.dirname(path.join(cfg.root, cfg.run.report)),
    "taf-result.json",
  );
}

export function triagePath(cfg) {
  return path.join(
    path.dirname(path.join(cfg.root, cfg.run.report)),
    "triage.json",
  );
}

export { rel };
