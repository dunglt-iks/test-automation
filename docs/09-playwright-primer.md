# 09 — Playwright cho người mới

## 1. Playwright là gì

Thư viện cho phép **code điều khiển trình duyệt** (Chromium, Firefox, WebKit) như người dùng thật: mở trang, bấm, gõ, rồi kiểm tra màn hình. Repo dùng bản TypeScript `@playwright/test`, các test nằm ở `web/e2e/`.

## 2. Bốn khái niệm

| Khái niệm | Ví dụ | Ý nghĩa |
|---|---|---|
| `page` | `page.goto('/#/dl/dl_deal')` | Một tab trình duyệt |
| Locator | `page.getByTestId('dl-f01-scr01-add')`, `getByRole('button', { name: 'Lưu' })` | Cách tìm một phần tử |
| Action | `.click()`, `.fill('abc')` | Thao tác như người dùng |
| Assertion | `await expect(locator).toBeVisible()` | Kiểm tra. Sai thì test fail. |

Playwright **tự chờ**: bấm một nút chưa hiện thì nó đợi tới khi hiện (có giới hạn thời gian). Không viết lệnh chờ cứng.

```ts
import { test, expect } from '@playwright/test';

test('TC-DL-F01-001 DL-F01-US01: thêm deal', async ({ page }) => {
  await page.goto('/#/dl/dl_deal');
  await page.getByRole('button', { name: 'Thêm deal' }).click();
  await page.getByLabel('Tên deal').fill('E2E TAF deal 1');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('E2E TAF deal 1')).toBeVisible();
});
```

## 3. Một lần chạy diễn ra thế nào

```
App phải đang chạy:  Postgres + Redis ◄─ Backend :8090 ◄─ Frontend :8001 ◄─ Playwright

1. Đọc playwright.config.ts (baseURL, thư mục test, retry)
2. Chạy globalSetup (TAF: tạo persona, lưu phiên đăng nhập)
3. Tìm các file *.spec.ts
4. Mỗi test: mở ngữ cảnh trình duyệt sạch → chạy từng dòng → expect sai thì dừng, đánh fail
5. Test fail: lưu trace (từng bước, ảnh chụp, request mạng)
6. Xuất kết quả: list / HTML / JSON
```

**Playwright không tự dựng app.** CI phải dựng DB, BE, FE trước (`env.up`).

## 4. TAF nằm ở đâu

TAF không thay Playwright. Nó lo phần xung quanh: viết TC, sinh script, chọn test cần chạy, đọc lỗi, ghi bug. Còn bấm vào app vẫn là Playwright.

| Ai | Làm gì |
|---|---|
| BA / reviewer | Duyệt TC markdown (không cần biết code) |
| Claude | Sinh TC nháp, dịch TC sang script, đọc lỗi |
| Playwright | Mở trình duyệt, chạy script, báo pass/fail, ghi trace |
| TAF | Nối các bước, gate, ghi bug, báo cáo |

## 5. Lệnh hay dùng

Khi BE (`cd server && make http`) và FE (`cd web && pnpm dev`) đang chạy:

```bash
cd web
pnpm exec playwright test login.spec.ts              # chạy một file
pnpm exec playwright test --grep TC-DL-F05-002       # chạy theo mã TC
pnpm exec playwright test login.spec.ts --headed     # hiện trình duyệt
pnpm exec playwright test --ui                       # giao diện chạy từng bước
pnpm exec playwright show-trace test-results/…/trace.zip   # tua lại một test fail
pnpm exec playwright codegen localhost:8001          # tự bấm, Playwright viết code tương ứng
```

`codegen` là cách nhanh nhất để hiểu Playwright: thao tác trên trang và xem dòng code tương ứng hiện ra.

## 6. Đọc thêm

- `docs/guide-en/testing.md`: quy ước test của repo, mục "Requirement traceability"
- Tài liệu chính thức: playwright.dev (Locators, Assertions, Trace viewer, Authentication)
