// @ts-check
// taf init: cài TAF vào repo dự án — thư mục e2e/ (cấu hình, testcases/, pages/), lệnh /testcase,
// workflow mẫu, .gitignore.
// Không ghi đè file đã có (trừ khi --force).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAF = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** [nguồn trong TAF, đích trong dự án] */
export const INIT_FILES = [
  ["templates/taf.config.yml", "e2e/taf.config.yml"],
  ["templates/testcases-README.md", "e2e/testcases/README.md"],
  ["templates/pages-README.md", "e2e/pages/README.md"],
  ["claude/commands/testcase.md", ".claude/commands/testcase.md"],
  ["templates/workflows/e2e-spec.yml", ".github/workflows/e2e-spec.yml"],
  [
    "templates/workflows/e2e-regression.yml",
    ".github/workflows/e2e-regression.yml",
  ],
  [
    "templates/workflows/testcase-draft.yml",
    ".github/workflows/testcase-draft.yml",
  ],
];

const IGNORE = ["/.taf", "/e2e/test-results/"];

/**
 * @param {string} root thư mục dự án
 * @param {{ force?: boolean, dryRun?: boolean }} [o]
 * @returns {{ file: string, action: 'create'|'overwrite'|'keep'|'update' }[]}
 */
export function initProject(root, o = {}) {
  const out = [];
  for (const [src, dst] of INIT_FILES) {
    const to = path.join(root, dst);
    const exists = fs.existsSync(to);
    const action = exists ? (o.force ? "overwrite" : "keep") : "create";
    out.push({ file: dst, action });
    if (o.dryRun || action === "keep") continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(TAF, src), to);
  }
  const gi = path.join(root, ".gitignore");
  const current = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  const lines = current.split("\n").map((l) => l.trim());
  const missing = IGNORE.filter((l) => !lines.includes(l));
  if (missing.length) {
    out.push({ file: ".gitignore", action: "update" });
    if (!o.dryRun)
      fs.writeFileSync(
        gi,
        `${current}${current && !current.endsWith("\n") ? "\n" : ""}# TAF\n${missing.join("\n")}\n`,
      );
  }
  return out;
}
