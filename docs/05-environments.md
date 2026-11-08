# 05 — Môi trường, tài khoản, persona: phần của dự án

TAF **không** dựng môi trường, không cấu hình hệ thống, không tạo tài khoản, vai trò hay persona. Những việc này mỗi ứng dụng làm một kiểu, và Playwright đã có sẵn chỗ cho chúng (`globalSetup`, fixture, `storageState`). TAF chỉ cần dự án khai **lệnh** cho từng target.

## 1. TAF cần gì từ dự án

```yaml
run:
  targets:
    ci:
      start: ./ci/app-up.sh      # tuỳ chọn. Thoát 0 nghĩa là app đã sẵn sàng nhận test
      stop: ./ci/app-down.sh     # tuỳ chọn. Luôn chạy, kể cả khi start/test lỗi
      test: npx playwright test --reporter=json,list {files}
      cwd: .                     # thư mục chạy lệnh, mặc định gốc repo
      logs: [ci/logs/*.log]      # in 100 dòng cuối khi start lỗi
    dev:
      test: E2E_ENV=dev npx playwright test --reporter=json,list {files}
```

| TAF lo | Dự án lo |
|---|---|
| Thứ tự start → test → stop, stop luôn chạy | Nội dung lệnh: dựng DB, migrate, seed, chạy BE/FE, cấu hình site |
| Thay `{files}` bằng script của các feature cần chạy (để trống khi `--all`) | Playwright config, `globalSetup`, cách chọn môi trường |
| Đặt biến `TAF_TARGET`, `TAF_ROOT`, `TAF_FILES`, `PLAYWRIGHT_JSON_OUTPUT_NAME` | Đọc secret, tạo tài khoản, đăng nhập, lưu `storageState` |
| Đọc JSON report sau khi chạy | Bật reporter `json` trong lệnh test hoặc trong config |

## 2. Persona trong test case

TC có dòng `persona: sale`. Với TAF đó chỉ là **một cái tên**:

- `testcases.personas` (tuỳ chọn) trỏ tới file liệt kê tên hợp lệ (map YAML thì lấy các khoá, danh sách thì lấy phần tử). `lint-tc` báo lỗi persona lạ.
- Khi sinh script, Claude ánh xạ tên persona sang code theo **hướng dẫn của dự án** (`scripts.guide`), vd "persona X dùng `test.use({ storageState: '.auth/X.json' })`".

## 3. Gợi ý cách dự án tự làm

Không bắt buộc, chỉ là cách đã dùng trong [`examples/demo`](../examples/demo/) và dự kiến cho app-base:

| Việc | Gợi ý |
|---|---|
| Chọn môi trường | Biến `E2E_ENV` hoặc `E2E_BASE_URL` trong lệnh `test` của từng target |
| Bí mật | Secret của CI, file `.env.e2e.local` (gitignore) khi chạy local |
| Persona | Khai trong file của dự án (vd `e2e/personas.yml`). `globalSetup` tạo tài khoản qua API (nếu cần) và đăng nhập một lần, lưu `.auth/<persona>.json` |
| Cách ly giữa các lần chạy | Tuỳ app: DB trắng mỗi lần (`ci`), hoặc tenant/workspace riêng cho test, hoặc tiền tố tên dữ liệu |
| Môi trường dùng chung | Tài khoản test cố định, dữ liệu có tiền tố để dọn |
| Môi trường production | Không chạy test ghi dữ liệu |

Ví dụ app-base (đa tenant): `globalSetup` đăng nhập tài khoản quản trị nền tảng, tạo tenant `E2E <runId>`, tạo vai trò và tài khoản theo `personas.yml` của app-base, lưu `storageState`. Toàn bộ nằm trong repo app-base.
