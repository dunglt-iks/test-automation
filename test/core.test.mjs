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

test("plan-gen / check-script / rehash: script theo TC đã duyệt, phát hiện lệch và lỗi", async () => {
  const { planGen, checkScript, rehash } = await import("../cli/src/scripts.mjs");
  const dir = shopProject({
    "taf.config.yml": `version: 1
spec: { adapter: ./taf/adapter.mjs }
testcases: { dir: tc, labels: en }
scripts: { dir: e2e/gen, ext: .spec.js, forbid: ['page\\.locator\\('] }
`,
    "e2e/gen/SHOP-12.spec.js": `import { test } from "../fx.js";
test("TC-SHOP-12-001 Checkout", async ({ page }) => {});
`,
  });
  const cfg = await loadProject({ root: dir });
  assert.deepEqual(
    planGen(cfg, ["SHOP-12", "SHOP-99"]).map((p) => [p.feature, p.action]),
    [
      ["SHOP-12", "update"],
      ["SHOP-99", "skip"],
    ],
  );
  assert.match(checkScript(cfg, "SHOP-12").errors.join("\n"), /thiếu dòng \/\/ @taf-source/);

  const header = rehash(cfg, "SHOP-12");
  assert.match(header, /^\/\/ @taf-source tc\/SHOP\/SHOP-12.md sha256:[0-9a-f]{16}$/);
  assert.deepEqual(checkScript(cfg, "SHOP-12").errors, []);
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "ok");

  // TC đổi: thêm TC-002, đánh DEPRECATED TC-001 → script lệch, thiếu test, test thừa
  const tc = path.join(dir, "tc/SHOP/SHOP-12.md");
  fs.writeFileSync(
    tc,
    fs
      .readFileSync(tc, "utf8")
      .replace("## TC-SHOP-12-001 · Checkout", "## TC-SHOP-12-001 · Checkout [DEPRECATED]")
      .replace(
        "## Out of e2e scope",
        "## TC-SHOP-12-002 · Pay again\n- Trace: SHOP-12.1, SHOP-12/S1\n\n| # | Step | Expected result |\n|---|---|---|\n| 1 | a | b |\n\n## Out of e2e scope",
      ),
  );
  const sp = path.join(dir, "e2e/gen/SHOP-12.spec.js");
  fs.appendFileSync(sp, 'test.only("TC-SHOP-12-007 x", async ({ page }) => { page.locator("a"); });\n');
  const errs = checkScript(cfg, "SHOP-12").errors.join("\n");
  assert.match(errs, /@taf-source lệch/);
  assert.match(errs, /TC-SHOP-12-001 đã DEPRECATED/);
  assert.match(errs, /TC-SHOP-12-007 không có trong test case/);
  assert.match(errs, /không được dùng test.only/);
  assert.match(errs, /thiếu test cho: TC-SHOP-12-002/);
  assert.match(errs, /mẫu bị cấm/);
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "update");

  fs.writeFileSync(tc, fs.readFileSync(tc, "utf8").replace("status: Approved", "status: Draft"));
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "skip");
});

test("check-paths: file ngoài allowedPaths và ngoài thư mục dự án đều bị bắt", async () => {
  const { checkPaths } = await import("../cli/src/scripts.mjs");
  const { execFileSync } = await import("node:child_process");
  const top = fs.mkdtempSync(path.join(os.tmpdir(), "taf-paths-"));
  const proj = path.join(top, "app");
  const files = {
    "taf.config.yml": `version: 1
spec: { adapter: ./taf/adapter.mjs }
scripts: { allowedPaths: ['e2e/gen/**', 'tc/**'] }
`,
    "taf/adapter.mjs": ADAPTER,
    "spec.json": "{}",
    "src/app.js": "1\n",
  };
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(proj, p)), { recursive: true });
    fs.writeFileSync(path.join(proj, p), c);
  }
  const g = (...a) => execFileSync("git", a, { cwd: top, encoding: "utf8" });
  g("init", "-q");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  const cfg = await loadProject({ root: proj });
  fs.mkdirSync(path.join(proj, "e2e/gen"), { recursive: true });
  fs.writeFileSync(path.join(proj, "e2e/gen/A.spec.js"), "x");
  assert.deepEqual(checkPaths(cfg).outside, []);
  fs.writeFileSync(path.join(proj, "src/app.js"), "2\n");
  fs.writeFileSync(path.join(top, "README.md"), "ngoài dự án");
  assert.deepEqual(checkPaths(cfg).outside, ["../README.md", "src/app.js"]);
});

test("newly-approved: so trạng thái duyệt giữa base và HEAD bằng adapter của dự án", async () => {
  const { newlyApproved } = await import("../cli/src/approved.mjs");
  const { execFileSync } = await import("node:child_process");
  const dir = shopProject({
    "spec.json": JSON.stringify({
      "SHOP-12": { name: "a", approved: true, cases: [] },
      "SHOP-13": { name: "b", approved: false, cases: [] },
    }),
  });
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  g("init", "-q");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
  const base = g("rev-parse", "HEAD");
  fs.writeFileSync(
    path.join(dir, "spec.json"),
    JSON.stringify({
      "SHOP-12": { name: "a", approved: true, cases: [] },
      "SHOP-13": { name: "b", approved: true, cases: [] },
      "SHOP-14": { name: "c", approved: true, cases: [] },
    }),
  );
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "duyệt");
  const cfg = await loadProject({ root: dir });
  assert.deepEqual(await newlyApproved(cfg, base), [
    { feature: "SHOP-13", hasTestcase: false },
    { feature: "SHOP-14", hasTestcase: false },
  ]);
  assert.equal(g("worktree", "list").split("\n").length, 1); // worktree tạm đã dọn
});

test("init: tạo file mẫu, giữ file đã có, thêm .gitignore một lần", async () => {
  const { initProject } = await import("../cli/src/init.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-init-"));
  fs.writeFileSync(path.join(dir, "taf.config.yml"), "version: 1\n");
  fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/");
  const first = initProject(dir);
  assert.deepEqual(
    first.map((r) => [r.file, r.action]),
    [
      ["taf.config.yml", "keep"],
      ["docs/testcases/README.md", "create"],
      [".claude/commands/testcase.md", "create"],
      [".github/workflows/e2e-spec.yml", "create"],
      [".github/workflows/e2e-regression.yml", "create"],
      [".github/workflows/testcase-draft.yml", "create"],
      [".gitignore", "update"],
    ],
  );
  assert.equal(fs.readFileSync(path.join(dir, "taf.config.yml"), "utf8"), "version: 1\n");
  assert.equal(
    fs.readFileSync(path.join(dir, ".gitignore"), "utf8"),
    "node_modules/\n# TAF\n/.taf\ntaf-results/\n",
  );
  assert.ok(!initProject(dir).some((r) => r.file === ".gitignore"));
});
