# templates/

File mẫu cho dự án. `taf init` copy chúng vào repo dự án (không ghi đè file đã có).

| File | Copy tới | Tài liệu |
|---|---|---|
| `taf.config.yml` | `taf.config.yml` | [01 §4](../docs/01-architecture.md) |
| `testcases-README.md` | `docs/testcases/README.md` | [02](../docs/02-testcase-format.md) |
| `testcase.md` | Mẫu một file TC (tham khảo) | [02](../docs/02-testcase-format.md) |
| `workflows/e2e-spec.yml` | `.github/workflows/` — PR: detect → gate → generate → run → report | [04 §3](../docs/04-ci-workflow.md) |
| `workflows/e2e-regression.yml` | `.github/workflows/` — sau CD / hằng đêm: run target `dev` → report, tự đóng bug | [04 §1](../docs/04-ci-workflow.md) |
| `workflows/testcase-draft.yml` | `.github/workflows/` — spec được duyệt → TC nháp → PR | [04 §2](../docs/04-ci-workflow.md) |

Trong workflow, chỗ đánh dấu `DỰ ÁN` là phần dự án phải sửa (cài phụ thuộc, runner, tên workflow CD, nhánh, thư mục spec). Ví dụ đã chạy thật: [`.github/workflows/demo-e2e-spec.yml`](../.github/workflows/demo-e2e-spec.yml) cho `examples/demo`.
