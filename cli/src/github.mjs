// @ts-check
// Tiện ích GitHub Actions: đọc sự kiện PR, ghi output/summary, comment và nhãn qua REST API (GITHUB_TOKEN).
import fs from "node:fs";
import { TafError } from "./config.mjs";

export function prFromEvent() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !fs.existsSync(p))
    throw new TafError(
      "Không có GITHUB_EVENT_PATH — chỉ dùng --github trong GitHub Actions",
    );
  const ev = JSON.parse(fs.readFileSync(p, "utf8"));
  const pr = ev.pull_request;
  if (!pr) throw new TafError("Sự kiện không phải pull_request");
  return {
    number: pr.number,
    title: pr.title || "",
    branch: pr.head?.ref || "",
    labels: (pr.labels || []).map((l) => l.name),
    base: pr.base.sha,
    head: pr.head.sha,
  };
}

export function setOutput(name, value) {
  const f = process.env.GITHUB_OUTPUT;
  const v = typeof value === "string" ? value : JSON.stringify(value);
  if (f) fs.appendFileSync(f, `${name}<<__TAF__\n${v}\n__TAF__\n`);
}

export function addSummary(md) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) fs.appendFileSync(f, `${md}\n`);
}

export async function api(method, url, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new TafError("Thiếu GITHUB_TOKEN");
  const res = await fetch(
    `${process.env.GITHUB_API_URL || "https://api.github.com"}${url}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  if (res.status === 404 && method === "DELETE") return null;
  if (!res.ok)
    throw new TafError(
      `GitHub API ${method} ${url}: ${res.status} ${await res.text()}`,
    );
  return res.status === 204 ? null : res.json();
}

const repo = () => process.env.GITHUB_REPOSITORY;

/** Sửa comment có marker nếu đã có, không thì tạo mới — mỗi PR một comment cho mỗi marker. */
export async function upsertComment(number, marker, body) {
  for (let page = 1; page < 20; page++) {
    const list = await api(
      "GET",
      `/repos/${repo()}/issues/${number}/comments?per_page=100&page=${page}`,
    );
    const found = list.find((c) => c.body?.includes(marker));
    if (found)
      return api("PATCH", `/repos/${repo()}/issues/comments/${found.id}`, {
        body,
      });
    if (list.length < 100) break;
  }
  return api("POST", `/repos/${repo()}/issues/${number}/comments`, { body });
}

export async function setLabel(number, label, on, color = "d93f0b") {
  if (on) {
    try {
      await api("POST", `/repos/${repo()}/labels`, { name: label, color });
    } catch {
      /* nhãn đã có */
    }
    return api("POST", `/repos/${repo()}/issues/${number}/labels`, {
      labels: [label],
    });
  }
  return api(
    "DELETE",
    `/repos/${repo()}/issues/${number}/labels/${encodeURIComponent(label)}`,
  );
}
