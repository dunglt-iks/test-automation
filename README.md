# TAF — Test Automation Framework

Framework kiểm thử end-to-end dùng chung cho nhiều dự án: **spec → test case markdown → script Playwright → chạy trên CI → ghi bug → báo cáo**, có Claude hỗ trợ ở các bước cần đọc hiểu.

> Trạng thái: **thiết kế (P0 chưa bắt đầu)**. Tài liệu thiết kế ở [`docs/`](docs/README.md). Các thư mục mã nguồn mới có README mô tả phần sẽ làm.

## Luồng tổng quát

```
Spec (mã luồng US / A# / E#)
  │ /testcase <mã>  hoặc Action khi spec được duyệt    ← Claude sinh, người review duyệt
  ▼
Test case markdown (trong repo dự án)                  ← push lên nhánh code
  │ PR vào nhánh phát triển
  ▼
detect → gate → generate script → dựng môi trường → chạy Playwright → triage → bug + báo cáo
```

## Cấu trúc repo

| Thư mục | Nội dung | Giai đoạn |
|---|---|---|
| [`docs/`](docs/README.md) | Tài liệu thiết kế | Có |
| [`templates/`](templates/README.md) | File mẫu dự án copy về: `taf.config.yml`, workflow, TC, persona, env | Có (bản nháp) |
| [`cli/`](cli/README.md) | `detect`, `gate`, `lint-tc`, `report`, `file-bugs`, `rehash`, `init` | P0–P2 |
| [`actions/`](actions/README.md) | Composite GitHub Action cho từng job | P0–P2 |
| [`prompts/`](prompts/README.md) | Prompt cho Claude: sinh TC, sinh script, triage | P0–P2 |
| [`claude/`](claude/README.md) | Lệnh Claude Code cài vào dự án (`/testcase`) | P0 |
| [`lib/`](lib/README.md) | Thư viện TypeScript dùng trong test: env, persona, cleanup, data-driven | P1 |
| [`adapters/`](adapters/README.md) | Spec adapter (đọc spec của từng dự án), tracker adapter (GitHub, Jira) | P0–P2 |

## Nguyên tắc

1. **Repo này không chứa gì riêng của một dự án.** Mọi thứ riêng (page object, fixture, persona, cách dựng môi trường) nằm trong repo dự án và khai báo qua `taf.config.yml`.
2. **Claude luôn chạy trong repo dự án**, framework chỉ cung cấp prompt, CLI và thư viện.
3. **Claude không sửa code ứng dụng.** Chỉ ghi vào test case và các thư mục test được phép.
4. Mọi bước quyết định (gate, chọn test, ghi bug) là code tất định. AI chỉ dùng để viết TC, viết script, đọc lỗi.

## Áp dụng cho một dự án (dự kiến)

1. Copy `templates/taf.config.yml` vào gốc repo dự án, khai báo đường dẫn spec, test, lệnh dựng môi trường.
2. Copy `templates/workflows/e2e-spec.yml` vào `.github/workflows/`.
3. Tạo secret `CLAUDE_CODE_OAUTH_TOKEN`, `TAF_TOKEN` (nếu repo này private) và tài khoản bootstrap.
4. Chạy `taf init` để cài lệnh `/testcase` vào `.claude/commands/`.

Chi tiết: [docs/01-architecture.md](docs/01-architecture.md), [docs/04-ci-workflow.md](docs/04-ci-workflow.md).

## Dự án đang dùng

| Dự án | Ghi chú |
|---|---|
| `app-base` (Sales Tools) | Dự án tham chiếu, thử nghiệm trên `DL-F05`, `FS-F02` |
