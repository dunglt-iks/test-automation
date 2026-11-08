# Dự án mẫu: Đơn hàng demo

Dự án nhỏ dùng TAF, để kiểm tra TAF trên CI của repo này và làm hình mẫu cho dự án mới. Mọi thứ trong thư mục này là **phần của dự án**. TAF (ở `../../`) chỉ đọc `taf.config.yml` rồi gọi lệnh.

| Thành phần | File | Ai viết |
|---|---|---|
| App cần test | `app/server.mjs`, `app/pages/*.html` | Dự án |
| Spec (định dạng `prd-fsd`) | `docs/features/addon/DM-demo/PRD-demo.md`, `FSD-demo.md` | Dự án (BA) |
| Test case | `docs/testcases/DM/DM-F01.md`, `DM-F02.md` | Claude sinh (`/testcase`), người duyệt |
| Cấu hình TAF | `taf.config.yml` | Dự án |
| Dựng app cho target `ci` | `ci/app-up.sh`, `ci/app-down.sh` | Dự án |
| Playwright, persona, đăng nhập | `playwright.config.mjs`, `e2e/personas.yml`, `e2e/global-setup.mjs` | Dự án |
| Fixture dữ liệu, page object | `e2e/fixtures.mjs`, `e2e/pages/` | Dự án (Claude được bổ sung page object) |
| Hướng dẫn viết test | `e2e/TAF-GUIDE.md` | Dự án |
| Script sinh từ TC | `e2e/generated/*.spec.mjs` | Claude sinh (`prompts/script.md`) |
| Test viết tay | `e2e/smoke.spec.mjs` | Dự án |

## Chạy thử

```bash
cd examples/demo
npm ci && npx playwright install chromium
T="node ../../cli/bin/taf.mjs"
$T gate DM-F01 DM-F02                 # TC đã duyệt, phủ đủ
$T run --target ci --all              # dựng app tạm → chạy test → tắt app
$T report                             # bảng kết quả theo feature
```

## Bug cài sẵn

`DEMO_BUG=discount` làm app bỏ chiết khấu khi số lượng ≥ 10 (sai DM-BR01). TC `TC-DM-F02-002` và một dòng của `TC-DM-F02-003` bắt được lỗi này. Dùng để kiểm luồng triage → issue → tự đóng khi hết lỗi:

```bash
DEMO_BUG=discount $T run --target ci --all
```

`ci/app-up.sh` chuyển biến `DEMO_BUG` sang app.
