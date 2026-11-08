#!/usr/bin/env node
// @ts-check
// taf — CLI của Test Automation Framework. Chạy với cwd là gốc repo dự án (nơi có e2e/taf.config.yml).
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadProject, rel, TafError } from "../src/config.mjs";
import { detect } from "../src/detect.mjs";
import { gate, gateMarkdown, gateText, GATE_MARKER } from "../src/gate.mjs";
import {
  addSummary,
  prFromEvent,
  setLabel,
  setOutput,
  upsertComment,
} from "../src/github.mjs";
import { newlyApproved } from "../src/approved.mjs";
import { fileBugs } from "../src/bugs.mjs";
import { initProject } from "../src/init.mjs";
import {
  applyTriage,
  buildReport,
  loadResults,
  REPORT_MARKER,
  reportMarkdown,
  reportText,
  resultPath,
  triagePath,
} from "../src/report.mjs";
import { runTarget, sh } from "../src/run.mjs";
import {
  checkPaths,
  checkScript,
  listScripts,
  planGen,
  rehash,
} from "../src/scripts.mjs";
import {
  lintTestcase,
  loadPersonaNames,
  testcasePath,
} from "../src/testcase.mjs";

const HELP = `taf <lệnh> [tuỳ chọn]

  spec <mã>            In cấu trúc spec của feature: trạng thái, hash, US/nhánh/SCR cần phủ
       --json          In JSON (dùng cho prompt /testcase)
       --hash          Chỉ in specHash
  lint-tc [file…]      Kiểm cú pháp TC (mặc định: mọi file trong testcases.dir)
  gate <mã…>           Kiểm TC của các feature: có, đã duyệt, phủ đủ, không lỗi thời
       --md <file>     Ghi báo cáo markdown
       --github        Đọc PR từ sự kiện, comment + gắn/gỡ nhãn chặn
  detect               Lấy mã feature của PR
       --base <sha> --head <sha> --title <s> --branch <s> [--label <s>…]
       --github        Đọc PR từ sự kiện Actions, ghi output features / has_features
  plan-gen <mã…>       Feature nào cần sinh (lại) script: TC đã duyệt, script chưa có hoặc lệch hash
       [--features JSON] [--json] [--github]
  check-script [mã…]   Script khớp TC: @taf-source, đủ test cho mỗi TC, không mẫu cấm (mặc định: mọi script)
  check-paths          File đã đổi (so với --base, mặc định HEAD) phải nằm trong scripts.allowedPaths
       [--base <ref>]
  lint-script          Chạy lệnh scripts.lint của dự án
  rehash <mã>          Ghi lại hash @taf-source sau khi sửa tay script hoặc TC
  run --target <tên>   Chạy test trên target (run.targets): start → test → stop
       [<mã…> | --features JSON | --all]   script của các feature, hoặc toàn bộ
       [--merge]       Gộp kết quả vào JSON report cũ (chạy lại một phần)
  report [mã…]         Đọc JSON report (run.report) → kết quả theo feature, ghi taf-result.json
       [--features JSON] [--target <t>] [--results <file>] [--md <file>] [--json]
       [--github]      Comment lên PR (nếu là sự kiện PR) + step summary
       [--file-bugs]   Ghi bug app vào tracker theo fingerprint (dùng triage.json nếu có)
       [--assume app-bug] [--close-fixed] [--dry-run]
  file-bugs            = report --file-bugs (không comment)
  newly-approved       Feature được duyệt từ --base tới HEAD (để sinh TC nháp) [--json] [--github]
       --base <ref>
  init                 Cài TAF vào dự án (cwd hoặc --root): e2e/ (taf.config.yml, testcases/, pages/), /testcase, workflow mẫu
       [--force] [--dry-run]

Tuỳ chọn chung: --root <thư mục dự án> (mặc định cwd), --config <file> (mặc định e2e/taf.config.yml, rồi taf.config.yml)`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string" },
    config: { type: "string" },
    json: { type: "boolean" },
    hash: { type: "boolean" },
    md: { type: "string" },
    github: { type: "boolean" },
    base: { type: "string" },
    head: { type: "string" },
    title: { type: "string" },
    branch: { type: "string" },
    label: { type: "string", multiple: true },
    features: { type: "string" },
    target: { type: "string" },
    merge: { type: "boolean" },
    results: { type: "string" },
    "file-bugs": { type: "boolean" },
    assume: { type: "string" },
    "close-fixed": { type: "boolean" },
    "dry-run": { type: "boolean" },
    force: { type: "boolean" },
    all: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

const [cmd, ...args] = positionals;

function listTestcases(cfg) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md") && e.name !== "README.md") out.push(p);
    }
  };
  walk(path.join(cfg.root, cfg.testcases.dir));
  return out.sort();
}

async function main() {
  if (!cmd || opt.help) {
    console.log(HELP);
    return 0;
  }
  if (cmd === "init") {
    const root = path.resolve(opt.root || process.cwd());
    for (const r of initProject(root, { force: opt.force, dryRun: opt["dry-run"] }))
      console.log(
        `${{ create: "+", overwrite: "!", keep: "=", update: "~" }[r.action]} ${r.file}${r.action === "keep" ? " (đã có, giữ nguyên)" : ""}`,
      );
    console.log(`
Tiếp theo:
  1. Sửa e2e/taf.config.yml: spec (adapter, roots), trigger.codePaths, run.targets (mặc định đã đặt mọi file của TAF dưới e2e/)
  2. Viết page object trong e2e/pages/, hướng dẫn viết test (scripts.guide) và lệnh của từng target — xem .taf/examples/demo
     Playwright: đặt outputDir dưới e2e/test-results/ (vd e2e/test-results/playwright), không trùng thư mục gốc của nó
  3. Sửa bước "Phần của dự án" trong .github/workflows/e2e-*.yml (cài phụ thuộc, trình duyệt)
  4. Thêm secret CLAUDE_CODE_OAUTH_TOKEN để bật sinh script / triage / TC nháp trên CI
  5. Thử: node .taf/cli/bin/taf.mjs spec <mã>, rồi /testcase <mã> trong Claude Code`);
    return 0;
  }

  const cfg = await loadProject({ root: opt.root, config: opt.config });
  const adapter = cfg.adapter;

  if (cmd === "spec") {
    const f = args[0] && adapter.findFeature(args[0].toUpperCase());
    if (!f)
      throw new TafError(`Không tìm thấy feature ${args[0] ?? "(thiếu mã)"}`);
    if (opt.hash) return console.log(f.hash), 0;
    const { text, ...rest } = f;
    const required = adapter.requiredCodes(f);
    if (opt.json)
      return (
        console.log(
          JSON.stringify(
            {
              ...rest,
              required,
              testcaseFile: rel(cfg, testcasePath(cfg, f.code)),
              labels: cfg.labels,
              personas: loadPersonaNames(cfg),
            },
            null,
            2,
          ),
        ),
        0
      );
    console.log(`${f.code} — ${f.name}${f.deprecated ? " [DEPRECATED]" : ""}`);
    console.log(`  spec:      ${f.file}:${f.line}`);
    console.log(
      `  trạng thái: ${f.status ?? "?"} → ${f.approved ? "đã duyệt" : "CHƯA duyệt"}${f.statusFile ? ` (${f.statusFile})` : ""}`,
    );
    console.log(`  specHash:  ${f.hash}`);
    console.log(`  test case: ${rel(cfg, testcasePath(cfg, f.code))}`);
    console.log(`  phải phủ (${required.length}): ${required.join(", ") || "—"}`);
    return 0;
  }

  if (cmd === "lint-tc") {
    const files = args.length
      ? args.map((a) => path.resolve(a))
      : listTestcases(cfg);
    let errors = 0;
    for (const f of files) {
      const { issues } = lintTestcase(cfg, f);
      for (const i of issues) {
        if (i.level === "error") errors++;
        console.log(
          `${rel(cfg, f)}:${i.line} ${i.level === "error" ? "✘" : "⚠"} ${i.msg}`,
        );
      }
    }
    console.log(`${files.length} file, ${errors} lỗi`);
    return errors ? 1 : 0;
  }

  if (cmd === "gate") {
    let codes = args.map((a) => a.toUpperCase());
    if (opt.features) codes = JSON.parse(opt.features);
    if (!codes.length) throw new TafError("gate cần ít nhất một mã feature");
    const report = gate(cfg, codes);
    console.log(gateText(report));
    const md = gateMarkdown(report);
    if (opt.md) fs.writeFileSync(opt.md, md);
    if (opt.github) {
      addSummary(md);
      const pr = prFromEvent();
      await upsertComment(pr.number, GATE_MARKER, md);
      await setLabel(pr.number, cfg.gate.blockedLabel, !report.ok);
    }
    return report.ok ? 0 : 1;
  }

  if (cmd === "detect") {
    const pr = opt.github
      ? prFromEvent()
      : {
          title: opt.title,
          branch: opt.branch,
          labels: opt.label || [],
          base: opt.base,
          head: opt.head || "HEAD",
        };
    if (!pr.base) throw new TafError("detect cần --base <sha> (hoặc --github)");
    const r = detect(cfg, pr);
    if (opt.json) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(`Feature: ${r.features.join(", ") || "(không có)"}`);
      if (r.unknown.length)
        console.log(`⚠ Mã không có trong spec: ${r.unknown.join(", ")}`);
      console.log(
        `Nguồn: tiêu đề [${r.sources.title}] nhánh [${r.sources.branch}] commit [${r.sources.commits}] status [${r.sources.status}]`,
      );
      console.log(
        `File đổi: ${r.files}, file code: ${r.codeFiles}${r.skip ? `, có nhãn ${cfg.trigger.skipLabel}` : ""}`,
      );
    }
    if (opt.github) {
      setOutput("features", r.features);
      setOutput("has_features", String(r.features.length > 0));
      addSummary(
        `**E2E-TAF detect:** ${r.features.join(", ") || "không có feature"}${r.error ? `\n\n✘ ${r.error}` : ""}`,
      );
      if (!r.features.length && !r.error)
        await setLabel(
          prFromEvent().number,
          cfg.gate.blockedLabel,
          false,
        ).catch(() => {});
    }
    if (r.error) {
      console.error(`✘ ${r.error}`);
      return 1;
    }
    return 0;
  }

  const featureArgs = () =>
    opt.features ? JSON.parse(opt.features) : args.map((a) => a.toUpperCase());

  if (cmd === "plan-gen") {
    const plan = planGen(cfg, featureArgs());
    const todo = plan.filter((p) => p.action === "new" || p.action === "update");
    if (opt.json) console.log(JSON.stringify(plan, null, 2));
    else
      for (const p of plan)
        console.log(
          `${{ new: "+", update: "~", ok: "✓", skip: "-" }[p.action]} ${p.feature}: ${p.reason}`,
        );
    if (opt.github) {
      setOutput("features", todo.map((p) => p.feature));
      setOutput("has_work", String(todo.length > 0));
    }
    return 0;
  }

  if (cmd === "check-script") {
    const list =
      args.length || opt.features ? featureArgs() : listScripts(cfg);
    let errors = 0;
    for (const f of list) {
      const r = checkScript(cfg, f);
      errors += r.errors.length;
      console.log(`${r.errors.length ? "✘" : "✓"} ${r.file}`);
      r.errors.forEach((e) => console.log(`    ✘ ${e}`));
      r.warnings.forEach((w) => console.log(`    ⚠ ${w}`));
    }
    console.log(`${list.length} script, ${errors} lỗi`);
    return errors ? 1 : 0;
  }

  if (cmd === "check-paths") {
    const r = checkPaths(cfg, opt.base);
    for (const f of r.files)
      console.log(`${r.outside.includes(f) ? "✘" : "✓"} ${f}`);
    if (r.outside.length) {
      console.error(
        `✘ ${r.outside.length} file nằm ngoài scripts.allowedPaths — không được commit`,
      );
      return 1;
    }
    console.log(`${r.files.length} file, đều trong scripts.allowedPaths`);
    return 0;
  }

  if (cmd === "lint-script") {
    if (!cfg.scripts.lint) return console.log("scripts.lint chưa khai"), 0;
    console.log(`$ ${cfg.scripts.lint}`);
    return sh(cfg.scripts.lint, { cwd: cfg.root, env: {} });
  }

  if (cmd === "rehash") {
    if (!args[0]) throw new TafError("rehash cần mã feature");
    console.log(rehash(cfg, args[0].toUpperCase()));
    return 0;
  }

  if (cmd === "report" || cmd === "file-bugs") {
    const resultsFile = path.resolve(
      opt.results || path.join(cfg.root, cfg.run.report),
    );
    const report = buildReport(cfg, {
      results: loadResults(resultsFile),
      features: opt.features || args.length ? featureArgs() : [],
      target: opt.target,
    });
    const tp = triagePath(cfg);
    if (fs.existsSync(tp))
      applyTriage(report, JSON.parse(fs.readFileSync(tp, "utf8")));
    let issues = {};
    if (cmd === "file-bugs" || opt["file-bugs"]) {
      const r = await fileBugs(cfg, report, {
        assume: opt.assume,
        closeFixed: opt["close-fixed"],
        dryRun: opt["dry-run"],
      });
      issues = r.issues;
      report.bugs = r.actions.map((a) => ({
        type: a.type,
        title: a.failure?.title ?? a.key,
        issue: a.issue?.id ?? issues[a.failure?.fingerprint] ?? null,
      }));
    }
    const out = resultPath(cfg);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    if (cmd === "file-bugs") return 0;
    const md = reportMarkdown(report, { issues });
    if (opt.md) fs.writeFileSync(opt.md, md);
    if (opt.json) console.log(JSON.stringify(report, null, 2));
    else console.log(reportText(report));
    if (opt.github) {
      addSummary(md);
      if (process.env.GITHUB_EVENT_NAME?.startsWith("pull_request"))
        await upsertComment(prFromEvent().number, REPORT_MARKER, md);
      setOutput("failed", String(report.totals.failed));
    }
    return 0;
  }

  if (cmd === "newly-approved") {
    if (!opt.base) throw new TafError("newly-approved cần --base <ref>");
    const list = await newlyApproved(cfg, opt.base);
    const todo = list.filter((x) => !x.hasTestcase).map((x) => x.feature);
    if (opt.json) console.log(JSON.stringify(list, null, 2));
    else if (!list.length) console.log("Không có feature nào vừa được duyệt");
    else
      for (const x of list)
        console.log(`${x.hasTestcase ? "=" : "+"} ${x.feature}${x.hasTestcase ? " (đã có test case)" : ""}`);
    if (opt.github) {
      setOutput("features", todo);
      setOutput("has_features", String(todo.length > 0));
    }
    return 0;
  }

  if (cmd === "run") {
    if (!opt.target) throw new TafError("run cần --target <tên>");
    const features = opt.features
      ? JSON.parse(opt.features)
      : args.map((a) => a.toUpperCase());
    if (!opt.all && !features.length)
      throw new TafError("run cần mã feature, --features hoặc --all");
    const r = await runTarget(cfg, {
      target: opt.target,
      features,
      all: opt.all,
      merge: opt.merge,
    });
    if (r.skipped) console.log(`Bỏ qua: ${r.skipped}`);
    if (opt.github) {
      setOutput("report", r.report);
      setOutput("ran", String(!r.skipped));
      setOutput("exit_code", String(r.code));
    }
    return r.code;
  }

  throw new TafError(`Không có lệnh "${cmd}". Gõ taf --help`);
}

main().then(
  (code) => process.exit(code ?? 0),
  (e) => {
    console.error(e instanceof TafError ? `taf: ${e.message}` : e);
    process.exit(2);
  },
);
