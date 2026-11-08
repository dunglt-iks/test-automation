# TAF — Test Automation Framework

Framework kiểm thử end-to-end dùng chung cho nhiều dự án: **spec → test case markdown → script Playwright → chạy trên CI → ghi bug → báo cáo**, có Claude hỗ trợ ở các bước cần đọc hiểu.

> Trạng thái: **v1.0.0**. Chạy trên CI của repo này với dự án mẫu [`examples/demo`](examples/demo/). Lộ trình và việc áp dụng app-base: [docs/08](docs/08-roadmap.md). Tài liệu thiết kế ở [`docs/`](docs/README.md).

## Luồng tổng quát

```
Spec (đọc qua spec adapter)
  │ /testcase <mã>  hoặc Action khi spec được duyệt    ← Claude sinh, người review duyệt
  ▼
Test case markdown (trong repo dự án)                  ← push lên nhánh code
  │ PR
  ▼
detect → gate → generate script → run target (lệnh của dự án) → report → triage → bug
                                   │
Sau CD / hằng đêm: run target dev ─┴─► report, bug tự mở / tự đóng
```

## Cấu trúc repo

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| [`docs/`](docs/README.md) | Tài liệu thiết kế | Có |
| [`templates/`](templates/README.md) | File mẫu (`taf init` copy về): `e2e/taf.config.yml`, `e2e/testcases/`, `e2e/pages/`, 3 workflow | Có |
| [`cli/`](cli/README.md) | Lệnh `taf` | Có |
| [`actions/`](actions/README.md) | Composite action: detect, gate, generate, run, report, testcase-draft | Có |
| [`prompts/`](prompts/README.md) | Prompt cho Claude: sinh TC, sinh script, triage | Có |
| [`claude/`](claude/README.md) | Lệnh Claude Code cài vào dự án (`/testcase`) | Có |
| [`test/`](test/) | Unit test của CLI (`npm test`) | Có |
| [`examples/demo/`](examples/demo/) | Dự án mẫu chạy đủ luồng | Có |
| [`adapters/`](adapters/README.md) | Spec adapter (`prd-fsd`), tracker adapter (`github`). Dự án viết adapter riêng được | Có |

## Nguyên tắc

1. **TAF chỉ giữ cơ chế.** Môi trường, tài khoản, persona, dữ liệu test, page object là của dự án. TAF không deploy, chỉ gọi lệnh dự án khai trong `e2e/taf.config.yml` ([điểm cắm](docs/01-architecture.md)).
2. **Claude luôn chạy trong repo dự án**, framework chỉ cung cấp prompt, CLI và action.
3. **Claude không sửa code ứng dụng.** Chỉ ghi vào test case và các thư mục test được phép.
4. Mọi bước quyết định (gate, chọn test, ghi bug) là code tất định. AI chỉ dùng để viết TC, viết script, đọc lỗi.

## Áp dụng cho một dự án

Hình mẫu đầy đủ: [`examples/demo`](examples/demo/) (chạy trên CI của repo này).

1. **Đưa TAF vào repo**: `git clone --branch v1.0.0 https://github.com/dunglt-iks/test-automation .taf` (hoặc symlink). Trên CI, workflow mẫu tự checkout vào `.taf`.
2. **Cài file mẫu**: `node .taf/cli/bin/taf.mjs init` → thư mục `e2e/` (`taf.config.yml`, `testcases/`, `pages/`), `/testcase`, 3 workflow, `.gitignore`. Mọi file TAF sinh ra về sau cũng nằm dưới `e2e/` ([vị trí file](docs/01-architecture.md#vị-trí-file-trong-dự-án)).
3. **Khai `e2e/taf.config.yml`** (đường dẫn tính từ gốc repo; thư mục mặc định đã đặt sẵn dưới `e2e/`):
   - `spec`: adapter (`prd-fsd` có sẵn, hoặc viết adapter riêng theo [hợp đồng](docs/01-architecture.md)).
   - `testcases`: thư mục, bộ nhãn `vi`/`en`, file persona (tuỳ chọn).
   - `scripts`: thư mục script, hướng dẫn viết test, `allowedPaths`, `forbid`, `lint`, `verifyTarget`.
   - `run.targets`: lệnh `start`/`test`/`stop` cho `ci` (app dựng tạm trong job) và `dev` (môi trường đã deploy).
   - `trigger.codePaths`.
4. **Viết phần của dự án**: Playwright config (`globalSetup` đăng nhập persona…, `outputDir` dưới `e2e/test-results/`), fixture dữ liệu, page object (nên đặt ở `e2e/pages/`), hướng dẫn viết test (`scripts.guide`), lệnh dựng app cho target `ci`.
5. **Sửa chỗ `DỰ ÁN` trong workflow** (cài phụ thuộc, runner, tên workflow CD, nhánh). Thêm secret `CLAUDE_CODE_OAUTH_TOKEN` để bật sinh script, triage, TC nháp trên CI.
6. **Thử**: `taf spec <mã>` → `/testcase <mã>` → duyệt TC → `taf gate <mã>` → mở PR.

Chi tiết: [docs/01-architecture.md](docs/01-architecture.md), [docs/04-ci-workflow.md](docs/04-ci-workflow.md).

## Dự án đang dùng

| Dự án | Ghi chú |
|---|---|
| `examples/demo` | Dự án mẫu trong repo này, chạy trên CI |
| `app-base` (Sales Tools) | Áp dụng sau v1.0.0 (P0 đã thử qua PR #39, đang Draft) |
