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
| `taf plan-gen` | Feature cần sinh (lại) script | [03 §2](../docs/03-script-generation.md) | **Có** |
| `taf check-script` | Script khớp TC, không mẫu cấm | [03 §3](../docs/03-script-generation.md) | **Có** |
| `taf check-paths` | File đã đổi nằm trong `scripts.allowedPaths` | [03 §5](../docs/03-script-generation.md) | **Có** |
| `taf lint-script` | Chạy `scripts.lint` của dự án | [03 §6](../docs/03-script-generation.md) | **Có** |
| `taf rehash <mã>` | Ghi lại hash `@taf-source` sau khi sửa tay | [03 §3](../docs/03-script-generation.md) | **Có** |
| `taf report` | JSON Playwright → bảng theo feature, `taf-result.json`, comment PR | [07 §4](../docs/07-bug-reporting.md) | **Có** |
| `taf file-bugs` | Tạo, ghi nhận gặp lại, mở lại, đóng issue theo fingerprint | [07 §3](../docs/07-bug-reporting.md) | **Có** |
| `taf newly-approved` | Feature vừa được duyệt giữa hai commit | [04 §2](../docs/04-ci-workflow.md) | **Có** |
| `taf init` | Cài file cấu hình, `/testcase`, workflow mẫu vào dự án | [templates](../templates/README.md) | **Có** |

## Mã nguồn

| File | Nội dung |
|---|---|
| `bin/taf.mjs` | Điểm vào, phân lệnh |
| `src/config.mjs` | Đọc `taf.config.yml`, giá trị mặc định, nạp adapter (`loadProject`) |
| `src/codes.mjs` | Tìm mã trong văn bản (mẫu mã lấy từ spec adapter), luật chuẩn hoá |
| `src/labels.mjs` | Bộ nhãn TC `vi` / `en` |
| `src/run.mjs` | `taf run` |
| `src/report.mjs`, `src/bugs.mjs` | `report`, `file-bugs` |
| `src/approved.mjs`, `src/init.mjs` | `newly-approved`, `init` |
| `src/scripts.mjs` | `plan-gen`, `check-script`, `check-paths`, `rehash` |
| `src/testcase.mjs` | Đọc TC markdown, `lint-tc` |
| `src/gate.mjs` | Gate, báo cáo text/markdown |
| `src/detect.mjs` | Detect |
| `src/github.mjs` | Output Actions, comment, nhãn qua REST API |
| `../adapters/spec/prd-fsd.mjs` | Spec adapter cho PRD + FSD |
