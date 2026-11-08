// @ts-check
// taf newly-approved: feature vừa được duyệt giữa hai commit (để sinh TC nháp tự động).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProject } from "./config.mjs";
import { testcasePath } from "./testcase.mjs";

function approvedSet(cfg) {
  const out = new Set();
  for (const code of cfg.adapter.listFeatures()) {
    const f = cfg.adapter.findFeature(code);
    if (f?.approved && !f.deprecated) out.add(code);
  }
  return out;
}

/**
 * Feature đã duyệt ở HEAD mà chưa duyệt (hoặc chưa có) ở `base`. Đọc spec ở `base` qua một
 * git worktree tạm, bằng chính adapter của dự án.
 * @returns {{ feature: string, hasTestcase: boolean }[]}
 */
export async function newlyApproved(cfg, base) {
  const run = (args, cwd = cfg.root) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const top = run(["rev-parse", "--show-toplevel"]);
  const sub = path.relative(top, fs.realpathSync(cfg.root));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "taf-base-"));
  let before = new Set();
  try {
    run(["worktree", "add", "--detach", "--quiet", tmp, base], top);
    const baseRoot = path.join(tmp, sub);
    if (fs.existsSync(path.join(baseRoot, "taf.config.yml"))) {
      const baseCfg = await loadProject({ root: baseRoot });
      before = approvedSet(baseCfg);
    }
  } finally {
    try {
      run(["worktree", "remove", "--force", tmp], top);
    } catch {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  return [...approvedSet(cfg)]
    .filter((c) => !before.has(c))
    .sort()
    .map((feature) => ({
      feature,
      hasTestcase: fs.existsSync(testcasePath(cfg, feature)),
    }));
}
