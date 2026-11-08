# TAF — Test Automation Framework

Framework kiểm thử end-to-end dùng chung cho nhiều dự án: **spec → test case markdown → script Playwright → chạy trên CI → ghi bug → báo cáo**, có Claude hỗ trợ ở các bước cần đọc hiểu.

> Trạng thái: đang hoàn thiện tới v1.0.0, xem [lộ trình](docs/08-roadmap.md). Tài liệu thiết kế ở [`docs/`](docs/README.md).

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
| [`cli/`](cli/README.md) | Lệnh `taf` | Có |
| [`actions/`](actions/README.md) | Composite GitHub Action cho từng job | `detect`, `gate` có |
| [`prompts/`](prompts/README.md) | Prompt cho Claude: sinh TC, sinh script, triage | `testcase.md` có |
| [`claude/`](claude/README.md) | Lệnh Claude Code cài vào dự án (`/testcase`) | Có |
| [`test/`](test/) | Unit test của CLI (`npm test`) | Có |
| [`adapters/`](adapters/README.md) | Spec adapter (`prd-fsd`), tracker adapter (`github`). Dự án viết adapter riêng được | Có |

## Nguyên tắc

1. **TAF chỉ giữ cơ chế.** Môi trường, tài khoản, persona, dữ liệu test, page object là của dự án. TAF không deploy, chỉ gọi lệnh dự án khai trong `taf.config.yml` ([điểm cắm](docs/01-architecture.md)).
2. **Claude luôn chạy trong repo dự án**, framework chỉ cung cấp prompt, CLI và thư viện.
3. **Claude không sửa code ứng dụng.** Chỉ ghi vào test case và các thư mục test được phép.
4. Mọi bước quyết định (gate, chọn test, ghi bug) là code tất định. AI chỉ dùng để viết TC, viết script, đọc lỗi.

## Áp dụng cho một dự án (P0)

1. Copy `templates/taf.config.yml` vào gốc repo dự án, sửa đường dẫn spec và mẫu mã feature.
2. Clone repo này vào `.taf/` của dự án (hoặc symlink), thêm `/.taf` vào `.gitignore`.
3. Copy `claude/commands/testcase.md` vào `.claude/commands/` của dự án.
4. Tạo workflow chỉ có job detect + gate (xem `app-base/.github/workflows/e2e-spec.yml`). Repo này public nên không cần token để checkout.
5. Thử: `node .taf/cli/bin/taf.mjs spec <mã>`, rồi `/testcase <mã>` trong Claude Code, rồi `taf gate <mã>`.

Từ P1 có thêm `templates/workflows/e2e-spec.yml` đầy đủ và `taf init`.

Chi tiết: [docs/01-architecture.md](docs/01-architecture.md), [docs/04-ci-workflow.md](docs/04-ci-workflow.md).

## Dự án đang dùng

| Dự án | Ghi chú |
|---|---|
| `app-base` (Sales Tools) | Dự án tham chiếu, thử nghiệm trên `DL-F05`, `FS-F02` |
