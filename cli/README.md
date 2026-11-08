# cli/

Công cụ dòng lệnh `taf` (Node.js ≥ 20, JavaScript ESM có `// @ts-check`, phụ thuộc duy nhất `yaml`). Mọi lệnh đều tất định, không gọi AI.

Chạy với cwd là repo dự án: `node .taf/cli/bin/taf.mjs <lệnh>` (`--help` để xem tuỳ chọn). Unit test: `npm test` ở gốc repo này.

| Lệnh | Việc làm | Tài liệu | Giai đoạn |
|---|---|---|---|
| `taf spec <mã>` | In luồng/nhánh/màn hình cần phủ, trạng thái duyệt, specHash (`--json` cho prompt) | [02 §4](../docs/02-testcase-format.md) | **Có** |
| `taf detect` | Lấy mã feature của PR (tiêu đề, nhánh, tiêu đề commit, diff status file) | [04 §2](../docs/04-ci-workflow.md) | **Có** |
| `taf gate` | Kiểm TC: có, đã duyệt, phủ đủ US/A/E/SCR, `specHash` khớp; `--github` comment + nhãn | [02 §3–4](../docs/02-testcase-format.md) | **Có** |
| `taf lint-tc` | Kiểm cú pháp TC markdown | [02 §2](../docs/02-testcase-format.md) | **Có** |
| `taf run --target <t>` | Chạy target của dự án: start → test → stop, gom JSON report | [04 §1](../docs/04-ci-workflow.md), [05](../docs/05-environments.md) | **Có** |
| `taf check-paths` | So `git diff` với `scripts.allowedPaths` | [03 §5](../docs/03-script-generation.md) | P1 |
| `taf rehash <file>` | Cập nhật hash `@taf-source` sau khi sửa script bằng tay | [03 §4](../docs/03-script-generation.md) | P1 |
| `taf report` | Đọc JSON của Playwright → comment PR, `taf-result.json` | [07 §3–4](../docs/07-bug-reporting.md) | P2 |
| `taf file-bugs` | Tạo, mở lại, đóng issue theo fingerprint | [07 §2](../docs/07-bug-reporting.md) | P2 |
| `taf init` | Cài lệnh `/testcase` và file mẫu vào repo dự án | [01 §2](../docs/01-architecture.md) | P3 |

## Mã nguồn

| File | Nội dung |
|---|---|
| `bin/taf.mjs` | Điểm vào, phân lệnh |
| `src/config.mjs` | Đọc `taf.config.yml`, giá trị mặc định, nạp adapter (`loadProject`) |
| `src/codes.mjs` | Tìm mã trong văn bản (mẫu mã lấy từ spec adapter), luật chuẩn hoá |
| `src/labels.mjs` | Bộ nhãn TC `vi` / `en` |
| `src/run.mjs` | `taf run` |
| `src/testcase.mjs` | Đọc TC markdown, `lint-tc` |
| `src/gate.mjs` | Gate, báo cáo text/markdown |
| `src/detect.mjs` | Detect |
| `src/github.mjs` | Output Actions, comment, nhãn qua REST API |
| `../adapters/spec/prd-fsd.mjs` | Spec adapter cho PRD + FSD |
