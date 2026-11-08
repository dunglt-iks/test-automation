// @ts-check
// taf file-bugs: lỗi được phân loại là bug ứng dụng → issue theo fingerprint (tạo / ghi nhận gặp
// lại / mở lại), và đóng issue khi TC của nó đã pass. Xem docs/07-bug-reporting.md.
import { importAdapter, rel, TafError } from "./config.mjs";
import { testcasePath } from "./testcase.mjs";

const FP = /<!--\s*taf:fp=([0-9a-f]+)\s*-->/;
const TC = /<!--\s*taf:tc=(\S+)\s*-->/;

export async function loadTracker(cfg) {
  const mod = await importAdapter(cfg, "tracker", cfg.tracker.adapter);
  if (typeof mod.createTracker !== "function")
    throw new TafError(
      `Tracker adapter "${cfg.tracker.adapter}" phải export createTracker(cfg)`,
    );
  return mod.createTracker(cfg);
}

export function issueTitle(f) {
  return `[e2e] ${f.title}`.slice(0, 250);
}

export function issueBody(cfg, report, f) {
  const lines = [
    `**Test:** \`${f.title}\``,
    f.feature ? `**Feature:** ${f.feature}` : null,
    f.tc
      ? `**Test case:** \`${rel(cfg, testcasePath(cfg, f.feature))}\` — ${f.tc}`
      : null,
    `**Script:** \`${f.file}:${f.line}\``,
    report.target ? `**Target:** ${report.target}` : null,
    report.commit ? `**Commit:** ${report.commit}` : null,
    report.run ? `**Run:** ${report.run} (artifact có trace, ảnh chụp)` : null,
    "",
    "**Lỗi**",
    "```",
    f.error.split("\n").slice(0, 15).join("\n"),
    "```",
    f.triage?.summary ? `\n**Phân tích (triage):** ${f.triage.summary}` : null,
    "",
    `<!-- taf:fp=${f.fingerprint} -->`,
    f.tc ? `<!-- taf:tc=${f.tc} -->` : `<!-- taf:tc=${f.title} -->`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/**
 * Lập kế hoạch (không gọi tracker): mỗi bug app → create | seen | reopen; issue mở có TC đã
 * pass hết và không còn fail → close.
 * @param {{ id: any, state: string, body: string }[]} existing
 * @param {{ assume?: string, closeFixed?: boolean }} o
 */
export function planBugs(report, existing, o = {}) {
  // Nhiều issue cùng fingerprint: ưu tiên đang mở, rồi đã đóng vì sửa xong (số lớn nhất).
  // Chỉ còn issue người đóng dạng "not planned" → tôn trọng: bỏ qua, không mở lại, không tạo mới.
  const rank = (i) =>
    i.state === "open" ? 3 : i.reason === "not_planned" ? 1 : 2;
  const byFp = new Map();
  for (const i of existing) {
    const m = FP.exec(i.body);
    if (!m) continue;
    const prev = byFp.get(m[1]);
    if (!prev || rank(i) > rank(prev) || (rank(i) === rank(prev) && i.id > prev.id))
      byFp.set(m[1], i);
  }
  const actions = [];
  const unclassified = [];
  for (const f of report.failures) {
    if (f.knownFixed) continue; // test lỗi đã biết lại pass: việc của người gỡ dấu, không phải bug app
    const cls = f.triage?.class || o.assume || null;
    if (!cls) {
      unclassified.push(f.title);
      continue;
    }
    if (cls !== "app-bug") continue;
    const issue = byFp.get(f.fingerprint);
    if (!issue) actions.push({ type: "create", failure: f });
    else if (issue.state === "open")
      actions.push({ type: "seen", failure: f, issue });
    else if (issue.reason === "not_planned")
      actions.push({ type: "ignored", failure: f, issue });
    else actions.push({ type: "reopen", failure: f, issue });
  }
  if (o.closeFixed) {
    // TC còn test lỗi đã biết thì chưa coi là đã pass hết
    const failing = new Set(
      [...report.failures, ...(report.known || [])].map((f) => f.tc || f.title),
    );
    const passing = new Set(
      report.tests
        .filter((t) => t.outcome === "passed")
        .map((t) => t.tc || t.title),
    );
    const failingFp = new Set(report.failures.map((f) => f.fingerprint));
    for (const i of existing) {
      if (i.state !== "open") continue;
      const fp = FP.exec(i.body)?.[1];
      const key = TC.exec(i.body)?.[1];
      if (!fp || !key || failingFp.has(fp)) continue;
      if (passing.has(key) && !failing.has(key))
        actions.push({ type: "close", key, issue: i });
    }
  }
  return { actions, unclassified };
}

/**
 * @param {any} cfg
 * @param {any} report
 * @param {{ assume?: string, closeFixed?: boolean, dryRun?: boolean, log?: (m: string) => void }} o
 */
export async function fileBugs(cfg, report, o = {}) {
  const log = o.log || console.log;
  const labels = cfg.tracker.labels;
  const tracker =
    o.dryRun && !process.env.GITHUB_TOKEN ? null : await loadTracker(cfg);
  const existing = tracker ? await tracker.list({ labels }) : [];
  const { actions, unclassified } = planBugs(report, existing, o);
  /** @type {Record<string, any>} fingerprint → issue id */
  const issues = {};
  const where = report.run || report.commit || "lần chạy local";
  for (const a of actions) {
    const f = a.failure;
    const tag = o.dryRun ? "[dry-run] " : "";
    if (a.type === "create") {
      const extra = f.feature ? [`feature:${f.feature}`] : [];
      log(`${tag}+ tạo issue: ${issueTitle(f)}`);
      if (!o.dryRun) {
        const r = await tracker.create({
          title: issueTitle(f),
          body: issueBody(cfg, report, f),
          labels: [...labels, ...extra],
        });
        issues[f.fingerprint] = r.id;
      }
    } else if (a.type === "seen") {
      log(`${tag}= gặp lại #${a.issue.id}: ${f.title}`);
      issues[f.fingerprint] = a.issue.id;
      if (!o.dryRun) await tracker.comment(a.issue.id, `Vẫn lỗi ở ${where}.`);
    } else if (a.type === "reopen") {
      log(`${tag}↺ mở lại #${a.issue.id}: ${f.title}`);
      issues[f.fingerprint] = a.issue.id;
      if (!o.dryRun) {
        await tracker.reopen(a.issue.id);
        await tracker.comment(
          a.issue.id,
          `Lỗi tái diễn ở ${where}.\n\n\`\`\`\n${f.error.split("\n").slice(0, 8).join("\n")}\n\`\`\``,
        );
      }
    } else if (a.type === "ignored") {
      log(`- bỏ qua (#${a.issue.id} đã được đóng "not planned"): ${f.title}`);
      issues[f.fingerprint] = a.issue.id;
    } else if (a.type === "close") {
      log(`${tag}✓ đóng #${a.issue.id}: ${a.key} đã pass`);
      if (!o.dryRun) {
        await tracker.comment(
          a.issue.id,
          `\`${a.key}\` đã pass ở ${where}. Tự đóng.`,
        );
        await tracker.close(a.issue.id);
      }
    }
  }
  if (unclassified.length)
    log(
      `⚠ ${unclassified.length} test fail chưa phân loại (không có triage, không có --assume): không ghi bug`,
    );
  return { actions, unclassified, issues };
}
