# actions/

Composite GitHub Action, mỗi thư mục là một bước trong workflow `e2e-spec.yml` của dự án. Dự án checkout repo này vào `.taf/` rồi gọi `uses: ./.taf/actions/<tên>`.

| Action | Gọi | AI | Tài liệu |
|---|---|---|---|
| `detect/` | `taf detect` | Không | [04 §2](../docs/04-ci-workflow.md) |
| `gate/` | `taf lint-tc` + `taf gate`, comment + nhãn `e2e-blocked` | Không | [04 §2, §4](../docs/04-ci-workflow.md) |
| `generate/` | Claude + `prompts/script.md`, rồi `taf check-paths`, `tsc`, lint, commit | Có | [03](../docs/03-script-generation.md) |
| `run/` | `env.up` của dự án, `playwright test`, commit status | Không | [05](../docs/05-environments.md) |
| `triage/` | Claude + `prompts/triage.md`, sửa script ≤ 2 vòng | Có | [07 §1](../docs/07-bug-reporting.md) |
| `report/` | `taf report` + `taf file-bugs` | Không | [07](../docs/07-bug-reporting.md) |

Mỗi thư mục sẽ có `action.yml`. Hiện chưa làm.
