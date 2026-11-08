import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { planBugs } from "../cli/src/bugs.mjs";
import { loadProject } from "../cli/src/config.mjs";
import {
  applyTriage,
  buildReport,
  errorSignature,
  fingerprint,
  flattenResults,
  reportMarkdown,
  reportText,
} from "../cli/src/report.mjs";
import { mergeResults } from "../cli/src/run.mjs";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "proj",
);

async function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-rep-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return loadProject({ root: dir });
}

const err = (expected, received, id = 12) =>
  `Error: \u001b[2mexpect(\u001b[22mlocator).toHaveText(expected) failed\n\nLocator:  getByTestId('total-${id}')\nExpected: "${expected}"\nReceived: "${received}"\nTimeout:  5000ms\n\nCall log:\n  - waiting`;

const spec = (title, status, message, file = "generated/XX-F01.spec.mjs") => ({
  title,
  file,
  line: 3,
  tests: [
    {
      projectName: "chromium",
      status,
      results:
        status === "expected"
          ? [{ status: "passed" }]
          : status === "flaky"
            ? [{ status: "failed", error: { message } }, { status: "passed" }]
            : [
                {
                  status: "failed",
                  error: { message },
                  attachments: [{ name: "screenshot", path: "/tmp/a.png" }],
                },
              ],
    },
  ],
});

const RESULTS = {
  stats: { duration: 1234 },
  suites: [
    {
      title: "generated/XX-F01.spec.mjs",
      specs: [
        spec("TC-XX-F01-001 Tạo đơn", "expected"),
        spec("TC-XX-F01-002 Tổng tiền", "unexpected", err("45.000", "50.000")),
      ],
      suites: [
        {
          title: "manager",
          specs: [spec("TC-XX-F01-003 Quyền", "flaky", "x")],
        },
      ],
    },
    {
      title: "smoke.spec.mjs",
      specs: [
        spec("smoke XX-F01-SCR01: mở được", "expected", null, "smoke.spec.mjs"),
      ],
    },
  ],
};

test("flattenResults: test lồng trong describe, outcome, lỗi bỏ màu và call log", () => {
  const t = flattenResults(RESULTS);
  assert.deepEqual(
    t.map((x) => [x.title, x.outcome]),
    [
      ["TC-XX-F01-001 Tạo đơn", "passed"],
      ["TC-XX-F01-002 Tổng tiền", "failed"],
      ["TC-XX-F01-003 Quyền", "flaky"],
      ["smoke XX-F01-SCR01: mở được", "passed"],
    ],
  );
  assert.equal(
    t[2].fullTitle,
    "manager › TC-XX-F01-003 Quyền",
  );
  assert.doesNotMatch(t[1].error, /\u001b|Call log/);
  assert.match(t[1].error, /Expected: "45.000"/);
});

test("fingerprint: không đổi theo giá trị thực tế / mã bản ghi, đổi theo giá trị mong đợi", () => {
  const a = fingerprint("TC-1", err("45.000", "50.000", 12));
  assert.equal(a, fingerprint("TC-1", err("45.000", "51.000", 99)));
  assert.notEqual(a, fingerprint("TC-1", err("6.000", "12.000")));
  assert.notEqual(a, fingerprint("TC-2", err("45.000", "50.000")));
  assert.match(
    errorSignature(err("1", "2")),
    /^Error: expect\(locator\).*\| Locator: .*\| Expected: "1"$/,
  );
});

test("buildReport: theo feature — phủ spec, TC có test, script và test khác", async () => {
  const cfg = await project();
  const r = buildReport(cfg, {
    results: RESULTS,
    features: ["XX-F01", "XX-F03"],
    target: "ci",
  });
  assert.deepEqual(r.totals, {
    tests: 4,
    passed: 2,
    failed: 1,
    flaky: 1,
    skipped: 0,
    known: 0,
    durationMs: 1234,
  });
  const f1 = r.features.find((f) => f.feature === "XX-F01");
  assert.deepEqual(f1.generated, {
    total: 3,
    passed: 1,
    failed: 1,
    flaky: 1,
    skipped: 0,
    known: 0,
  });
  assert.deepEqual(f1.other, { total: 1, passed: 1, failed: 0 });
  assert.equal(f1.testcases.total, 3); // TC-003 DEPRECATED
  assert.equal(f1.testcases.withTest, 2);
  assert.deepEqual(f1.testcases.notRun, ["TC-XX-F01-004"]);
  assert.equal(f1.coverage.required, 5);
  const f3 = r.features.find((f) => f.feature === "XX-F03");
  assert.equal(f3.testcases, null);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].tc, "TC-XX-F01-002");
  assert.equal(r.failures[0].feature, "XX-F01");

  applyTriage(r, [
    {
      test: "TC-XX-F01-002 Tổng tiền",
      class: "app-bug",
      summary: "bỏ chiết khấu",
    },
  ]);
  const md = reportMarkdown(r, { issues: { [r.failures[0].fingerprint]: 7 } });
  assert.match(
    md,
    /^<!-- taf:report -->\n## E2E-TAF · ✘ 1 test fail · 2\/4 pass/,
  );
  assert.match(
    md,
    /\| XX-F01 Đơn hàng \| 5\/5 \| 2\/3 \| 1\/1\/1\/0 ✘ \| 1\/1 \|/,
  );
  assert.match(
    md,
    /TC-XX-F01-002 Tổng tiền — \*\*app-bug\*\*: bỏ chiết khấu · #7/,
  );
  assert.match(md, /Flaky.*TC-XX-F01-003/);
  assert.match(md, /TC chưa có test chạy: TC-XX-F01-004/);
});

test("planBugs: tạo / gặp lại / mở lại / bỏ qua not_planned / đóng khi đã pass / chưa phân loại", async () => {
  const cfg = await project();
  const r = buildReport(cfg, { results: RESULTS });
  const fp = r.failures[0].fingerprint;
  const body = (f, tc) => `x\n<!-- taf:fp=${f} -->\n<!-- taf:tc=${tc} -->`;

  assert.deepEqual(planBugs(r, []).unclassified, ["TC-XX-F01-002 Tổng tiền"]);
  assert.equal(
    planBugs(r, [], { assume: "app-bug" }).actions[0].type,
    "create",
  );
  applyTriage(r, [{ test: "TC-XX-F01-002 Tổng tiền", class: "script-bug" }]);
  assert.deepEqual(planBugs(r, [], { assume: "app-bug" }).actions, []);
  applyTriage(r, [{ test: "TC-XX-F01-002 Tổng tiền", class: "app-bug" }]);

  const kinds = (existing, o) =>
    planBugs(r, existing, o).actions.map((a) => [a.type, a.issue?.id]);
  assert.deepEqual(
    kinds([{ id: 1, state: "open", body: body(fp, "TC-XX-F01-002") }]),
    [["seen", 1]],
  );
  assert.deepEqual(
    kinds([
      {
        id: 1,
        state: "closed",
        reason: "completed",
        body: body(fp, "TC-XX-F01-002"),
      },
      {
        id: 5,
        state: "closed",
        reason: "not_planned",
        body: body(fp, "TC-XX-F01-002"),
      },
    ]),
    [["reopen", 1]],
  );
  assert.deepEqual(
    kinds([
      { id: 5, state: "closed", reason: "not_planned", body: body(fp, "x") },
    ]),
    [["ignored", 5]],
  );
  assert.deepEqual(
    kinds(
      [
        { id: 2, state: "open", body: body("aaaa", "TC-XX-F01-001") }, // TC đã pass → đóng
        { id: 3, state: "open", body: body("bbbb", "TC-XX-F01-002") }, // TC vẫn fail → giữ
        { id: 4, state: "open", body: body("cccc", "TC-XX-F09-001") }, // không chạy lần này → giữ
      ],
      { closeFixed: true },
    ),
    [
      ["create", undefined],
      ["close", 2],
    ],
  );
});

test("mergeResults: chạy lại một phần thay kết quả cũ, giữ phần còn lại, tính lại thống kê", () => {
  const rerun = {
    stats: { duration: 9 },
    suites: [
      {
        title: "generated/XX-F01.spec.mjs",
        specs: [
          spec("TC-XX-F01-002 Tổng tiền", "expected"),
          spec("TC-XX-F01-009 Mới", "expected"),
        ],
      },
    ],
  };
  const m = mergeResults(RESULTS, rerun);
  const t = flattenResults(m);
  assert.deepEqual(
    t.map((x) => [x.title, x.outcome]),
    [
      ["TC-XX-F01-001 Tạo đơn", "passed"],
      ["TC-XX-F01-002 Tổng tiền", "passed"],
      ["TC-XX-F01-003 Quyền", "flaky"],
      ["smoke XX-F01-SCR01: mở được", "passed"],
      ["TC-XX-F01-009 Mới", "passed"],
    ],
  );
  assert.deepEqual(
    { e: m.stats.expected, u: m.stats.unexpected, f: m.stats.flaky },
    { e: 4, u: 0, f: 1 },
  );
});

test("lỗi đã biết (test.fail): tách khỏi pass/fail; lại pass thì báo fail nhưng không ghi bug", async () => {
  const cfg = await project();
  const known = (title, status, resultStatus, note) => ({
    title,
    file: "generated/XX-F01.spec.mjs",
    line: 9,
    tests: [
      {
        projectName: "chromium",
        expectedStatus: "failed",
        status,
        annotations: [{ type: "fail", description: note }],
        results: [{ status: resultStatus, error: { message: "Error: x" } }],
      },
    ],
  });
  const results = {
    stats: {},
    suites: [
      {
        title: "generated/XX-F01.spec.mjs",
        specs: [
          spec("TC-XX-F01-001 Tạo đơn", "expected"),
          known("TC-XX-F01-002 Tổng tiền", "expected", "failed", "Lỗi app đã biết: https://github.com/o/r/issues/41"),
          known("TC-XX-F01-003 Quyền", "unexpected", "passed", "Lỗi app đã biết: https://github.com/o/r/issues/42"),
        ],
      },
    ],
  };
  const r = buildReport(cfg, { results, features: ["XX-F01"] });
  assert.deepEqual(
    { passed: r.totals.passed, failed: r.totals.failed, known: r.totals.known },
    { passed: 1, failed: 1, known: 1 },
  );
  assert.equal(r.known[0].tc, "TC-XX-F01-002");
  assert.match(r.known[0].note, /issues\/41/);
  assert.equal(r.failures[0].tc, "TC-XX-F01-003");
  assert.equal(r.failures[0].knownFixed, true);
  assert.match(r.failures[0].error, /đã pass — app có thể đã sửa/);
  const md = reportMarkdown(r);
  assert.match(md, /1 lỗi đã biết/);
  assert.match(md, /### Lỗi đã biết/);
  assert.match(md, /\[#41\]\(https:\/\/github\.com\/o\/r\/issues\/41\)/);
  assert.match(reportText(r), /1 lỗi đã biết/);
  // knownFixed không thành bug kể cả khi gán app-bug; TC còn lỗi đã biết không bị coi là đã pass
  const { actions } = planBugs(r, [], { assume: "app-bug", closeFixed: true });
  assert.equal(actions.length, 0);
});
