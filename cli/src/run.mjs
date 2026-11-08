// @ts-check
// taf run: chạy test trên một target của dự án (run.targets.<tên>): start? → test → stop?.
// TAF không biết bên trong các lệnh làm gì (dựng app, tạo dữ liệu, đăng nhập… là việc của dự án).
// Xem docs/04-ci-workflow.md §5.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TafError } from "./config.mjs";

/** File script của các feature (scripts.dir/<FEATURE><ext>) đang có trên đĩa, tuyệt đối. */
export function scriptFiles(cfg, features) {
  if (!cfg.scripts.dir) return [];
  return features
    .map((f) => path.join(cfg.root, cfg.scripts.dir, `${f}${cfg.scripts.ext}`))
    .filter((f) => fs.existsSync(f));
}

const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Thay {files} bằng danh sách file (đã quote); không có {files} thì nối vào cuối. */
export function fillFiles(command, files) {
  const list = files.map(quote).join(" ");
  if (command.includes("{files}")) return command.replaceAll("{files}", list);
  return list ? `${command} ${list}` : command;
}

/** Chạy lệnh bằng bash, kế thừa stdout/stderr. Trả mã thoát. */
export function sh(command, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(127));
  });
}

/** In 100 dòng cuối các file log của target (hỗ trợ * trong tên file). */
export function printLogs(cfg, logs = [], out = console.log) {
  for (const pattern of logs) {
    const dir = path.join(cfg.root, path.dirname(pattern));
    const re = new RegExp(
      `^${path
        .basename(pattern)
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")}$`,
    );
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => re.test(f))
      : [];
    if (!files.length) out(`(không có log ${pattern})`);
    for (const f of files) {
      const tail = fs
        .readFileSync(path.join(dir, f), "utf8")
        .split("\n")
        .slice(-100)
        .join("\n");
      out(
        `──── ${path.posix.join(path.dirname(pattern), f)} (100 dòng cuối)\n${tail}`,
      );
    }
  }
}

/**
 * @param {any} cfg
 * @param {{ target: string, features?: string[], all?: boolean, log?: (m: string) => void }} o
 * @returns {Promise<{ code: number, skipped?: string, report: string, files: string[] }>}
 */
export async function runTarget(cfg, o) {
  const log = o.log || console.log;
  const t = cfg.run.targets?.[o.target];
  const names = Object.keys(cfg.run.targets || {});
  if (!t)
    throw new TafError(
      `Không có target "${o.target}" trong run.targets (có: ${names.join(", ") || "—"})`,
    );
  if (!t.test) throw new TafError(`run.targets.${o.target} thiếu "test"`);
  const cwd = path.join(cfg.root, t.cwd || ".");
  const report = path.join(cfg.root, cfg.run.report);
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.rmSync(report, { force: true });

  let files = [];
  if (!o.all) {
    const abs = scriptFiles(cfg, o.features || []);
    if (!abs.length)
      return {
        code: 0,
        skipped: `Không có script cho ${(o.features || []).join(", ") || "feature nào"}`,
        report,
        files,
      };
    files = abs.map((f) => path.relative(cwd, f));
  }
  const env = {
    TAF_TARGET: o.target,
    TAF_ROOT: cfg.root,
    TAF_FILES: files.join(" "),
    PLAYWRIGHT_JSON_OUTPUT_NAME: report,
  };

  try {
    if (t.start) {
      log(`$ ${t.start}`);
      const c = await sh(t.start, { cwd, env });
      if (c !== 0) {
        printLogs(cfg, t.logs, log);
        throw new TafError(`run.targets.${o.target}.start thoát với mã ${c}`);
      }
    }
    const cmd = fillFiles(t.test, files);
    log(`$ ${cmd}`);
    const code = await sh(cmd, { cwd, env });
    if (code !== 0 && !fs.existsSync(report)) printLogs(cfg, t.logs, log);
    return { code, report, files };
  } finally {
    if (t.stop) {
      log(`$ ${t.stop}`);
      const c = await sh(t.stop, { cwd, env });
      if (c !== 0) log(`⚠ stop thoát với mã ${c}`);
    }
  }
}
