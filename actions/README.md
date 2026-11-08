# actions/

Composite GitHub Action, mỗi thư mục là một bước trong workflow `e2e-spec.yml` của dự án. Dự án checkout repo này vào `.taf/` rồi gọi `uses: ./.taf/actions/<tên>`.

| Action | Gọi | AI | Tài liệu |
|---|---|---|---|
| `detect/` | `taf detect`: mã feature của PR | Không | [04 §3](../docs/04-ci-workflow.md) |
| `gate/` | `taf gate`: comment + nhãn chặn | Không | [04 §3](../docs/04-ci-workflow.md) |
| `generate/` | `plan-gen` → Claude + `prompts/script.md` → `check-paths`, `check-script`, `lint-script` → commit vào PR | Có (bỏ qua nếu thiếu token) | [03](../docs/03-script-generation.md) |
| `run/` | `taf run --target`: start → test → stop, upload artifact | Không | [04 §1](../docs/04-ci-workflow.md) |
| `report/` | Claude triage (khi có fail và có token) → `taf report --github --file-bugs` → commit bản sửa script | Một phần | [07](../docs/07-bug-reporting.md) |
| `testcase-draft/` | `taf newly-approved` → Claude + `prompts/testcase.md` → PR TC nháp | Có | [04 §2](../docs/04-ci-workflow.md) |

Action đọc TAF từ chính thư mục của nó (`$GITHUB_ACTION_PATH/../..`); các bước gọi Claude dùng `<root>/.taf`, nên dự án checkout TAF vào `.taf` (hoặc symlink).
