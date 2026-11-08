// Lõi TAF không phụ thuộc định dạng spec của app-base: dự án tự viết spec adapter, TC tiếng Anh,
// target chạy test tuỳ ý.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadProject } from "../cli/src/config.mjs";
import { gateFeature } from "../cli/src/gate.mjs";
import { fillFiles, runTarget } from "../cli/src/run.mjs";
import { lintTestcase } from "../cli/src/testcase.mjs";

/** Dự án giả: spec là file JSON, mã feature dạng SHOP-12, nhánh SHOP-12.1, màn hình SHOP-12/S1. */
function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-core-"));
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), c);
  }
  return dir;
}

const ADAPTER = `
import fs from "node:fs";
import path from "node:path";
export function createSpecAdapter(cfg) {
  const specs = JSON.parse(fs.readFileSync(path.join(cfg.root, "spec.json"), "utf8"));
  return {
    findFeature: (code) => specs[code] ? { code, name: specs[code].name, file: "spec.json", line: 1,
      deprecated: false, approved: specs[code].approved, status: specs[code].approved ? "ok" : "draft",
      statusFile: "spec.json", hash: "h-" + code, stories: [], screens: [], cases: specs[code].cases } : null,
    listFeatures: () => Object.keys(specs),
    requiredCodes: (f) => f.cases,
    scopeOf: (code) => code.split("-")[0],
    featureRegex: () => /(?<![A-Z0-9])(SHOP-\\d+)(?![0-9.])/g,
    traceRegex: () => /(?<![A-Z0-9])(SHOP-\\d+(?:\\.\\d+|\\/S\\d+)?)(?![0-9])/g,
  };
}`;

const TC = `---
feature: SHOP-12
spec: spec.json
specHash: "h-SHOP-12"
status: Approved
reviewer: qa
persona: buyer
---

## TC-SHOP-12-001 · Checkout
- Trace: SHOP-12.1, SHOP-12/S1

| # | Step | Expected result |
|---|---|---|
| 1 | Pay | Paid |

## Out of e2e scope

| Code | Reason | Covered by |
|---|---|---|
| SHOP-12.2 | API only | unit test |
`;

function shopProject(extra = {}) {
  return makeProject({
    "taf.config.yml": `version: 1
spec: { adapter: ./taf/adapter.mjs }
testcases: { dir: tc, labels: en, personas: personas.yml }
scripts: { dir: e2e/gen, ext: .spec.js }
run:
  report: out/results.json
  targets:
    ci:
      start: echo start >> ../trace.txt
      test: echo test $TAF_TARGET {files} >> ../trace.txt && echo '{}' > "$PLAYWRIGHT_JSON_OUTPUT_NAME"
      stop: echo stop >> ../trace.txt
      cwd: e2e
      logs: [e2e/logs/*.txt]
    broken:
      start: exit 4
      test: echo never
      stop: echo stop >> trace.txt
      logs: [e2e/logs/*.txt]
`,
    "taf/adapter.mjs": ADAPTER,
    "spec.json": JSON.stringify({
      "SHOP-12": {
        name: "Checkout",
        approved: true,
        cases: ["SHOP-12.1", "SHOP-12.2", "SHOP-12/S1"],
      },
    }),
    "personas.yml": "- buyer\n- admin\n",
    "tc/SHOP/SHOP-12.md": TC,
    "e2e/gen/SHOP-12.spec.js": "// x\n",
    "e2e/logs/app.txt": "boom at line 9\n",
    ...extra,
  });
}

test("adapter của dự án + nhãn tiếng Anh: lint và gate chạy không cần prd-fsd", async () => {
  const cfg = await loadProject({ root: shopProject() });
  const tc = path.join(cfg.root, "tc/SHOP/SHOP-12.md");
  const { issues, parsed } = lintTestcase(cfg, tc);
  assert.deepEqual(issues, []);
  assert.deepEqual(parsed.cases[0].traces, ["SHOP-12.1", "SHOP-12/S1"]);
  const r = gateFeature(cfg, "SHOP-12");
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.coverage, { required: 3, covered: 3, missing: [] });

  fs.writeFileSync(
    tc,
    TC.replace("status: Approved", "status: Nháp").replace(
      "persona: buyer",
      "persona: ghost",
    ),
  );
  const msgs = lintTestcase(cfg, tc)
    .issues.map((i) => i.msg)
    .join("\n");
  assert.match(msgs, /"status" phải là Draft hoặc Approved/);
  assert.match(msgs, /Persona "ghost" không có trong personas.yml/);
});

test("adapter sai: báo thiếu hàm, không thấy file", async () => {
  const dir = shopProject({
    "taf/adapter.mjs":
      "export function createSpecAdapter() { return { findFeature() {} }; }",
  });
  await assert.rejects(loadProject({ root: dir }), /thiếu listFeatures\(\)/);
  fs.writeFileSync(
    path.join(dir, "taf.config.yml"),
    "version: 1\nspec: { adapter: ./khong-co.mjs }\n",
  );
  await assert.rejects(loadProject({ root: dir }), /Không thấy spec adapter/);
});

test("run: start → test (có {files}, biến TAF) → stop; bỏ qua khi không có script", async () => {
  const dir = shopProject();
  const cfg = await loadProject({ root: dir });
  const r = await runTarget(cfg, {
    target: "ci",
    features: ["SHOP-12", "SHOP-99"],
    log: () => {},
  });
  assert.equal(r.code, 0);
  assert.deepEqual(r.files, ["gen/SHOP-12.spec.js"]);
  assert.equal(
    fs.readFileSync(path.join(dir, "trace.txt"), "utf8"),
    "start\ntest ci gen/SHOP-12.spec.js\nstop\n",
  );
  assert.ok(fs.existsSync(path.join(dir, "out/results.json")));

  const none = await runTarget(cfg, {
    target: "ci",
    features: ["SHOP-99"],
    log: () => {},
  });
  assert.match(none.skipped, /Không có script cho SHOP-99/);

  await assert.rejects(
    runTarget(cfg, { target: "prod", all: true, log: () => {} }),
    /Không có target "prod".*có: ci, broken/,
  );
});

test("run: start lỗi → in log, vẫn chạy stop", async () => {
  const dir = shopProject();
  const cfg = await loadProject({ root: dir });
  const out = [];
  await assert.rejects(
    runTarget(cfg, { target: "broken", all: true, log: (m) => out.push(m) }),
    /start thoát với mã 4/,
  );
  assert.match(out.join("\n"), /boom at line 9/);
  assert.equal(fs.readFileSync(path.join(dir, "trace.txt"), "utf8"), "stop\n");
});

test("fillFiles: quote đường dẫn, không có {files} thì nối cuối", () => {
  assert.equal(
    fillFiles("pw test {files} --x", ["a b.ts", "c'd.ts"]),
    `pw test 'a b.ts' 'c'\\''d.ts' --x`,
  );
  assert.equal(fillFiles("pw test", ["a.ts"]), "pw test 'a.ts'");
  assert.equal(fillFiles("pw test {files}", []), "pw test ");
});
