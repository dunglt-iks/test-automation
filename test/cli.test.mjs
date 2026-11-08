import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { extractFeatures, extractTraces } from "../cli/src/codes.mjs";
import { loadProject } from "../cli/src/config.mjs";
import {
  detect,
  featuresFromStatusDiff,
  globToRegex,
} from "../cli/src/detect.mjs";
import { gateFeature } from "../cli/src/gate.mjs";
import { lintTestcase } from "../cli/src/testcase.mjs";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "proj",
);

/** Bản sao fixture vào thư mục tạm, TC được điền specHash thật. */
async function project({ hash = true, edit } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  const tc = path.join(dir, "e2e/testcases/XX/XX-F01.md");
  let text = fs.readFileSync(tc, "utf8");
  const first = await loadProject({ root: dir });
  if (hash) text = text.replace("HASH", first.adapter.findFeature("XX-F01").hash);
  if (edit) text = edit(text);
  fs.writeFileSync(tc, text);
  const cfg = await loadProject({ root: dir });
  return { dir, cfg, adapter: cfg.adapter, tc };
}

test("mã feature: chuẩn hoá tên nhánh CORE, bỏ qua chữ thường lẫn", async () => {
  const { cfg } = await project();
  assert.deepEqual(extractFeatures(cfg, "feat/core-c10-f06-c11-f04"), [
    "CORE-C10-F06",
    "CORE-C11-F04",
  ]);
  assert.deepEqual(
    extractFeatures(cfg, "fix(DL-F05-US02-A1): x; xem FS-F02-SCR03"),
    ["DL-F05", "FS-F02"],
  );
  assert.deepEqual(extractFeatures(cfg, "chore: cập nhật CI"), []);
  assert.deepEqual(
    extractTraces(cfg, "DL-F05-US01, DL-BR18 và CORE-C10-F01-US01-E2"),
    ["DL-F05-US01", "DL-BR18", "CORE-C10-F01-US01-E2"],
  );
});

test("spec adapter: luồng, nhánh, màn hình, DEPRECATED, trạng thái PRD", async () => {
  const { adapter } = await project();
  const f = adapter.findFeature("XX-F01");
  assert.equal(f.status, "Đã duyệt");
  assert.equal(f.approved, true);
  assert.deepEqual(
    f.stories.map((s) => [s.code, s.title, s.deprecated]),
    [
      ["XX-F01-US01", "Tạo đơn", false],
      ["XX-F01-US02", "[DEPRECATED] Xoá đơn", true],
    ],
  );
  assert.deepEqual(f.stories[0].branches, [
    "XX-F01-US01-A1",
    "XX-F01-US01-A2",
    "XX-F01-US01-E1",
  ]);
  assert.deepEqual(adapter.requiredCodes(f), [
    "XX-F01-US01",
    "XX-F01-US01-A1",
    "XX-F01-US01-A2",
    "XX-F01-US01-E1",
    "XX-F01-SCR01",
  ]);
  assert.equal(adapter.findFeature("XX-F02").deprecated, true);
  assert.equal(adapter.findFeature("XX-F03").approved, false);
  assert.equal(adapter.findFeature("XX-F09"), null);
  assert.deepEqual(adapter.listFeatures(), ["XX-F01", "XX-F02", "XX-F03"]);
});

test("specHash đổi khi nội dung spec đổi, không đổi vì khoảng trắng cuối dòng", async () => {
  const { dir, cfg, adapter } = await project();
  const before = adapter.findFeature("XX-F01").hash;
  const fsd = path.join(
    dir,
    "docs/features/addon/XX-demo/FSD-demo/F01-don-hang.md",
  );
  fs.writeFileSync(
    fsd,
    fs.readFileSync(fsd, "utf8").replace("Danh sách đơn.", "Danh sách đơn.   "),
  );
  assert.equal((await loadProject({ root: dir })).adapter.findFeature("XX-F01").hash, before);
  fs.writeFileSync(
    fsd,
    fs
      .readFileSync(fsd, "utf8")
      .replace("Danh sách đơn.", "Danh sách đơn hàng."),
  );
  assert.notEqual((await loadProject({ root: dir })).adapter.findFeature("XX-F01").hash, before);
});

test("lint-tc: file hợp lệ không có lỗi", async () => {
  const { cfg, tc } = await project();
  const { issues, parsed } = lintTestcase(cfg, tc);
  assert.deepEqual(
    issues.filter((i) => i.level === "error"),
    [],
  );
  assert.equal(parsed.cases.length, 4);
  assert.deepEqual(
    parsed.outOfScope.map((o) => o.code),
    ["XX-F01-US01-E1"],
  );
});

test("lint-tc: bắt mã sai, trùng, thiếu truy vết, thiếu cột kết quả, persona lạ, duyệt thiếu reviewer", async () => {
  const { cfg, tc } = await project({
    edit: (t) =>
      t
        .replace("reviewer: someone", 'reviewer: ""')
        .replace("TC-XX-F01-002", "TC-XX-F01-001")
        .replace("- Persona: manager", "- Persona: ghost")
        .replace("- Truy vết: XX-F01-US01-A1", "")
        .replace(
          "| # | Bước | Kết quả mong đợi |\n|---|---|---|\n| 1 | Bấm Thêm | Mở hộp |",
          "| # | Bước |\n|---|---|\n| 1 | Bấm |",
        )
        .concat(
          "\n## TC-XX-F01-4 · sai mã\n- Truy vết: XX-F01-US01\n\n| # | Bước | Kết quả mong đợi |\n|---|---|---|\n",
        ),
  });
  const msgs = lintTestcase(cfg, tc)
    .issues.filter((i) => i.level === "error")
    .map((i) => i.msg)
    .join("\n");
  assert.match(msgs, /phải có "reviewer"/);
  assert.match(msgs, /bị trùng/);
  assert.match(msgs, /persona "ghost"/);
  assert.match(msgs, /thiếu dòng "- Truy vết:"/);
  assert.match(msgs, /thiếu bảng có cột "Kết quả mong đợi"/);
  assert.match(msgs, /TC-XX-F01-4" phải dạng/);
});

test("gate: qua khi đủ điều kiện", async () => {
  const { cfg, adapter } = await project();
  const r = gateFeature(cfg, "XX-F01");
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
});

test("gate: báo nhánh chưa phủ, TC Nháp, TC lỗi thời", async () => {
  const { cfg, adapter } = await project({
    hash: false,
    edit: (t) =>
      t
        .replace('specHash: "HASH"', "specHash: 0000000000000000")
        .replace("status: Đã duyệt", "status: Nháp")
        .replace("| XX-F01-US01-E1 | Chỉ qua API | Go test |", ""),
  });
  const r = gateFeature(cfg, "XX-F01");
  assert.equal(r.ok, false);
  const all = r.problems.join("\n");
  assert.match(all, /còn Nháp/);
  assert.match(all, /lỗi thời/);
  assert.match(all, /Chưa phủ 1\/5 mã: XX-F01-US01-E1/);
});

test("gate: thiếu file TC, spec chưa duyệt, feature DEPRECATED bỏ qua", async () => {
  const { cfg, adapter } = await project();
  const r3 = gateFeature(cfg, "XX-F03");
  assert.match(r3.problems.join("\n"), /Spec chưa duyệt/);
  assert.match(
    r3.problems.join("\n"),
    /Chưa có test case `e2e\/testcases\/XX\/XX-F03.md`/,
  );
  const r2 = gateFeature(cfg, "XX-F02");
  assert.equal(r2.ok, true);
  assert.equal(r2.skipped, "Feature [DEPRECATED]");
});

test("glob và status diff", async () => {
  assert.ok(globToRegex("server/**").test("server/a/b.go"));
  assert.ok(globToRegex("web/src/**").test("web/src/x.vue"));
  assert.ok(!globToRegex("web/src/**").test("web/e2e/x.ts"));
  assert.ok(
    globToRegex("*.md").test("a.md") && !globToRegex("*.md").test("d/a.md"),
  );
  const { cfg } = await project();
  const diff =
    "+| XX-F01 | Đơn | Hoàn thành | x |\n+| XX-F03 | Mới | Đang triển khai | |\n-| XX-F02 | Cũ | Hoàn thành | |";
  assert.deepEqual(featuresFromStatusDiff(cfg, diff), ["XX-F01"]);
});

test("detect: lấy mã từ tiêu đề/nhánh/commit/status; đòi khai mã khi sửa code; nhãn bỏ qua", async () => {
  const { dir, cfg, adapter } = await project();
  const g = (...a) =>
    execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  g("init", "-q", "-b", "main");
  g(
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "init",
  );
  const base = g("rev-parse", "HEAD");
  fs.mkdirSync(path.join(dir, "server"), { recursive: true });
  fs.writeFileSync(path.join(dir, "server/a.go"), "package a\n");
  g("add", ".");
  g(
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "-m",
    "refactor: dọn code",
  );
  const head = g("rev-parse", "HEAD");

  const none = detect(cfg, {
    title: "refactor",
    branch: "chore/x",
    base,
    head,
  });
  assert.deepEqual(none.features, []);
  assert.match(none.error, /không khai mã feature/);

  const skip = detect(cfg, {
    title: "refactor",
    branch: "chore/x",
    labels: ["e2e-skip"],
    base,
    head,
  });
  assert.equal(skip.error, null);

  const ok = detect(cfg, {
    title: "feat(xx-f01): đơn",
    branch: "feat/xx-f09",
    base,
    head,
  });
  assert.deepEqual(ok.features, ["XX-F01"]);
  assert.deepEqual(ok.unknown, ["XX-F09"]);
  assert.equal(ok.error, null);

  fs.writeFileSync(
    path.join(dir, "docs/status.md"),
    "| Mã | Tên | Trạng thái | Ghi chú |\n|---|---|---|---|\n| XX-F03 | Mới | Hoàn thành | |\n",
  );
  g("add", ".");
  g(
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "-m",
    "docs: status",
  );
  const st = detect(cfg, {
    title: "x",
    branch: "y",
    base,
    head: g("rev-parse", "HEAD"),
  });
  assert.deepEqual(st.sources.status, ["XX-F03"]);
  assert.deepEqual(st.features, ["XX-F03"]);
});
