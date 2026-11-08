# cli/

Công cụ dòng lệnh `taf` (Node.js + TypeScript). Mọi lệnh đều tất định, không gọi AI.

| Lệnh | Việc làm | Tài liệu | Giai đoạn |
|---|---|---|---|
| `taf detect` | Lấy mã feature của PR (tiêu đề, nhánh, commit, diff status file) | [04 §2](../docs/04-ci-workflow.md) | P0 |
| `taf gate` | Kiểm TC: có, đã duyệt, phủ đủ US/A/E/SCR, `specHash` khớp | [02 §3–4](../docs/02-testcase-format.md) | P0 |
| `taf lint-tc` | Kiểm cú pháp TC markdown | [02 §2](../docs/02-testcase-format.md) | P0 |
| `taf check-paths` | So `git diff` với `scripts.allowedPaths` | [03 §5](../docs/03-script-generation.md) | P1 |
| `taf rehash <file>` | Cập nhật hash `@taf-source` sau khi sửa script bằng tay | [03 §4](../docs/03-script-generation.md) | P1 |
| `taf report` | Đọc JSON của Playwright → comment PR, `taf-result.json` | [07 §3–4](../docs/07-bug-reporting.md) | P2 |
| `taf file-bugs` | Tạo, mở lại, đóng issue theo fingerprint | [07 §2](../docs/07-bug-reporting.md) | P2 |
| `taf init` | Cài lệnh `/testcase` và file mẫu vào repo dự án | [01 §2](../docs/01-architecture.md) | P3 |
