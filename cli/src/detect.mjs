// @ts-check
// Detect: PR này thuộc những feature nào. Xem docs/04-ci-workflow.md §2.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { extractFeatures } from "./codes.mjs";

function git(cfg, args) {
  return execFileSync("git", args, {
    cwd: cfg.root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Glob đơn giản: ** = mọi thứ kể cả /, * = mọi thứ trừ /. */
export function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(file, globs) {
  return globs.some((g) => globToRegex(g).test(file));
}

/** Mã feature trong các dòng được thêm vào statusFile mà có ô trạng thái thuộc statusDone. */
export function featuresFromStatusDiff(cfg, diff) {
  const out = new Set();
  for (const line of diff.split("\n")) {
    if (!line.startsWith("+|")) continue;
    const cells = line
      .slice(1)
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim().replace(/\*\*/g, ""));
    if (!cells.some((c) => cfg.trigger.statusDone.includes(c))) continue;
    for (const f of extractFeatures(
      cfg,
      cells[0].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"),
    ))
      out.add(f);
  }
  return [...out];
}

/**
 * @param {{ title?: string, branch?: string, labels?: string[], base: string, head: string }} pr
 */
export function detect(cfg, pr) {
  const adapter = cfg.adapter;
  const range = `${pr.base}...${pr.head}`;
  // git trả đường dẫn tính từ gốc repo git; dự án có thể nằm ở thư mục con.
  const top = git(cfg, ["rev-parse", "--show-toplevel"]).trim();
  const files = git(cfg, ["diff", "--name-only", range])
    .split("\n")
    .filter(Boolean)
    .map((f) =>
      path
        .relative(fs.realpathSync(cfg.root), path.join(top, f))
        .split(path.sep)
        .join("/"),
    )
    .filter((f) => !f.startsWith("../"));
  const commits = git(cfg, ["log", "--format=%s", `${pr.base}..${pr.head}`]);
  const sources = {
    title: extractFeatures(cfg, pr.title),
    branch: extractFeatures(cfg, pr.branch),
    commits: extractFeatures(cfg, commits),
    status: [],
  };
  if (cfg.trigger.statusFile && files.includes(cfg.trigger.statusFile)) {
    sources.status = featuresFromStatusDiff(
      cfg,
      git(cfg, ["diff", range, "--", cfg.trigger.statusFile]),
    );
  }
  const all = [...new Set(Object.values(sources).flat())].sort();
  const known = all.filter((c) => adapter.findFeature(c));
  const unknown = all.filter((c) => !known.includes(c));
  const codeFiles = files.filter((f) => matchesAny(f, cfg.trigger.codePaths));
  const skip = (pr.labels || []).includes(cfg.trigger.skipLabel);
  let error = null;
  if (codeFiles.length && known.length === 0 && !skip) {
    error =
      `PR sửa ${codeFiles.length} file code (${codeFiles.slice(0, 3).join(", ")}${codeFiles.length > 3 ? ", …" : ""}) ` +
      `nhưng không khai mã feature nào. Ghi mã vào tiêu đề PR, tên nhánh hoặc commit (vd \`feat(dl-f05): …\`), ` +
      `hoặc gắn nhãn \`${cfg.trigger.skipLabel}\` nếu PR không đổi hành vi (refactor, sửa CI…).`;
  }
  return {
    features: skip ? [] : known,
    unknown,
    sources,
    files: files.length,
    codeFiles: codeFiles.length,
    skip,
    error,
  };
}
