// @ts-check
// Tracker adapter "github": GitHub Issues của repo đang chạy (GITHUB_REPOSITORY, GITHUB_TOKEN).
// Hợp đồng: createTracker(cfg) → { list, create, comment, reopen, close }. Xem docs/07-bug-reporting.md §5.
import { api } from "../../cli/src/github.mjs";

export function createTracker() {
  const repo = () => process.env.GITHUB_REPOSITORY;
  return {
    /** Mọi issue (mở và đóng) có tất cả nhãn `labels`. */
    async list({ labels }) {
      const out = [];
      for (let page = 1; page < 50; page++) {
        const items = await api(
          "GET",
          `/repos/${repo()}/issues?state=all&per_page=100&page=${page}&labels=${encodeURIComponent(labels.join(","))}`,
        );
        for (const i of items)
          if (!i.pull_request)
            out.push({
              id: i.number,
              title: i.title,
              state: i.state,
              // completed | not_planned | reopened | null
              reason: i.state_reason || null,
              body: i.body || "",
              url: i.html_url,
            });
        if (items.length < 100) break;
      }
      return out;
    },
    async create({ title, body, labels }) {
      const i = await api("POST", `/repos/${repo()}/issues`, { title, body, labels });
      return { id: i.number, url: i.html_url };
    },
    async comment(id, body) {
      await api("POST", `/repos/${repo()}/issues/${id}/comments`, { body });
    },
    async reopen(id) {
      await api("PATCH", `/repos/${repo()}/issues/${id}`, { state: "open" });
    },
    async close(id) {
      await api("PATCH", `/repos/${repo()}/issues/${id}`, { state: "closed", state_reason: "completed" });
    },
  };
}
