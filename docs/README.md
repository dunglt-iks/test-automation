# E2E-TAF — Test Automation Framework

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 1.1 |
| Trạng thái | Nháp, đề xuất |
| Cập nhật lần cuối | 2026-11-08 |
| Áp dụng đầu tiên | Sales Tools (`app-base`, nhánh `sale-tools`) |

> **Dự án tham chiếu:** các ví dụ trong tài liệu lấy từ `app-base` (mã spec `DL-F05`, `CORE-C10`…, file `web/e2e/dl-helpers.ts`, `.github/workflows/ci.yml`, `docs/guide-en/testing.md`). Đó là đường dẫn trong repo `app-base`, không phải trong repo này.

## Change Log

| Phiên bản | Ngày | Mô tả thay đổi | Tác giả |
|---|---|---|---|
| 1.1 | 2026-11-08 | P0: detect chỉ đọc tiêu đề commit, nhãn `e2e-skip`; specHash đặt trong ngoặc kép | BA Team |
| 1.0 | 2026-11-08 | Khởi tạo tài liệu | BA Team |

---

## Mục tiêu

Tự động hoá chuỗi **spec → test case → test script → chạy → ghi bug → báo cáo**. Framework nằm ở repo riêng [`dunglt-iks/test-automation`](https://github.com/dunglt-iks/test-automation) (gọi tắt `taf`) nên dùng lại được cho dự án khác (ví dụ Aida).

```
Spec (FSD: US / A# / E#)
  │ /testcase <mã>  hoặc Action khi spec Đã duyệt       ← Claude sinh, người review duyệt
  ▼
Test case markdown (docs/testcases/)                     ← push lên nhánh code
  │ PR vào sale-tools / main
  ▼
detect → gate → generate script → dựng môi trường → chạy Playwright → triage → bug + báo cáo
```

## Quyết định đã chốt

| # | Nội dung |
|---|---|
| D1 | Framework ở **repo riêng** `test-automation` (gọi tắt `taf`). Dự án chỉ thêm `taf.config.yml` và một workflow gọi tới nó. |
| D2 | **Claude luôn chạy trong repo ứng dụng.** `taf` chỉ cung cấp prompt, CLI và thư viện, không đọc code của dự án. |
| D3 | Script Playwright do AI sinh từ test case, **chỉ sinh lại khi test case đổi**, rồi commit vào nhánh PR. |
| D4 | Test case được sinh ở hai nơi: lệnh **`/testcase` local**, và **Action tự mở PR nháp** khi spec chuyển sang Đã duyệt. |
| D5 | Nhận diện tính năng của PR qua **mã feature trong tiêu đề, nhánh hoặc commit** và qua **dòng `implementation-status.md` đổi sang Hoàn thành**. |
| D6 | PR có tính năng mới mà thiếu test case đã duyệt thì **chặn mềm**: check đỏ, comment, nhãn `e2e-blocked`. Lý do: repo private gói Free không có branch protection. |
| D7 | Bug ghi vào **GitHub Issues**, kèm comment tổng hợp trên PR. |
| D8 | AI trong CI xác thực bằng **`CLAUDE_CODE_OAUTH_TOKEN`** (gói Claude). |
| D9 | Script tổ chức theo **Page Object Model**, ưu tiên locator `data-testid`. |
| D10 | Tài khoản test là **persona khai báo trong file**, tự tạo khi bắt đầu chạy. Không duy trì tài khoản bằng tay. |
| D11 | **Claude không được sửa bất kỳ file code nào của ứng dụng**, kể cả thêm `data-testid`. Chỉ ghi vào TC và thư mục test được phép, có cưỡng chế bằng quyền và kiểm tra diff ([03 §5](03-script-generation.md)). |

## Mục lục

| File | Nội dung |
|---|---|
| [01-architecture.md](01-architecture.md) | Kiến trúc, phân chia repo, `taf.config.yml` |
| [02-testcase-format.md](02-testcase-format.md) | Định dạng test case markdown, quy tắc phủ, quy trình duyệt |
| [03-script-generation.md](03-script-generation.md) | Sinh script: locator, Page Object Model, quy ước `data-testid` |
| [04-ci-workflow.md](04-ci-workflow.md) | GitHub Actions: trigger, các job, chặn mềm, giới hạn gói Free |
| [05-environments.md](05-environments.md) | Môi trường test, bí mật, persona và vai trò |
| [06-test-data.md](06-test-data.md) | Quản lý test data |
| [07-bug-reporting.md](07-bug-reporting.md) | Triage, ghi bug, báo cáo |
| [08-roadmap.md](08-roadmap.md) | Lộ trình, rủi ro, điểm còn mở |
| [09-playwright-primer.md](09-playwright-primer.md) | Playwright cho người mới |

## Thuật ngữ

| Từ | Nghĩa |
|---|---|
| TC | Test case markdown, mã `TC-<FEATURE>-###` |
| Script | File `*.spec.ts` Playwright sinh từ TC |
| Page object | Class bọc locator và thao tác của **một màn hình** (`SCR`) |
| Persona | Vai trò test có tên (`sale`, `sales-manager`…) |
| Gate | Bước kiểm tra TC đủ điều kiện trước khi chạy |
| Triage | Phân loại lỗi: bug ứng dụng / lỗi script / môi trường / flaky |
