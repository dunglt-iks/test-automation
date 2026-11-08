# templates/

File mẫu để dự án copy về (sau này `taf init` làm thay). Giá trị ví dụ lấy từ `app-base`, dự án khác sửa lại.

| File | Copy tới (repo dự án) | Tài liệu |
|---|---|---|
| `taf.config.yml` | `taf.config.yml` | [01 §3](../docs/01-architecture.md) |
| `workflows/e2e-spec.yml` | `.github/workflows/e2e-spec.yml` | [04](../docs/04-ci-workflow.md) |
| `testcase.md` | `docs/testcases/<scope>/<FEATURE>.md` | [02](../docs/02-testcase-format.md) |
| `personas.yml` | `web/e2e/personas.yml` | [05 §3](../docs/05-environments.md) |
| `env/ci.yml`, `env/dev.yml` | `web/e2e/env/` | [05 §2](../docs/05-environments.md) |

> Bản nháp: workflow gọi các action chưa làm. Đừng bật trên dự án trước khi xong P0.
