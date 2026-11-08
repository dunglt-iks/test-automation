#!/usr/bin/env node
// @ts-check
// taf — CLI của Test Automation Framework. Chạy với cwd là repo dự án (nơi có taf.config.yml).
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createSpecAdapter } from "../../adapters/spec/prd-fsd.mjs";
import { loadConfig, rel, TafError } from "../src/config.mjs";
import { detect } from "../src/detect.mjs";
import { gate, gateMarkdown, gateText, GATE_MARKER } from "../src/gate.mjs";
import {
  addSummary,
  prFromEvent,
  setLabel,
  setOutput,
  upsertComment,
} from "../src/github.mjs";
import { lintTestcase, testcasePath } from "../src/testcase.mjs";

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

Tuỳ chọn chung: --root <thư mục dự án> (mặc định cwd), --config <file>`;

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
  const cfg = loadConfig({ root: opt.root, config: opt.config });
  const adapter = createSpecAdapter(cfg);

  if (cmd === "spec") {
    const f = args[0] && adapter.findFeature(args[0].toUpperCase());
    if (!f)
      throw new TafError(`Không tìm thấy feature ${args[0] ?? "(thiếu mã)"}`);
    if (opt.hash) return console.log(f.hash), 0;
    const { text, ...rest } = f;
    if (opt.json)
      return (
        console.log(
          JSON.stringify(
            { ...rest, testcaseFile: rel(cfg, testcasePath(cfg, f.code)) },
            null,
            2,
          ),
        ),
        0
      );
    console.log(`${f.code} — ${f.name}${f.deprecated ? " [DEPRECATED]" : ""}`);
    console.log(`  spec:     ${f.file}:${f.line}`);
    console.log(
      `  trạng thái: ${f.status ?? "?"} (${f.statusFile ?? "không thấy PRD"})`,
    );
    console.log(`  specHash: ${f.hash}`);
    console.log(`  test case: ${rel(cfg, testcasePath(cfg, f.code))}`);
    console.log(
      `  màn hình: ${f.screens.map((s) => s.code + (s.deprecated ? " [DEPRECATED]" : "")).join(", ") || "—"}`,
    );
    for (const s of f.stories)
      console.log(
        `  ${s.code}${s.deprecated ? " [DEPRECATED]" : ""} ${s.title}\n      ${s.branches.join(", ") || "(không có nhánh)"}`,
      );
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
    const report = gate(cfg, adapter, codes);
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
    const r = detect(cfg, adapter, pr);
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

  throw new TafError(`Không có lệnh "${cmd}". Gõ taf --help`);
}

main().then(
  (code) => process.exit(code ?? 0),
  (e) => {
    console.error(e instanceof TafError ? `taf: ${e.message}` : e);
    process.exit(2);
  },
);
