# 06 — Test data

## Nguyên tắc

1. **Mỗi test tự tạo dữ liệu nó cần.** Không dựa vào dữ liệu test khác để lại, không dựa vào thứ tự chạy.
2. **Tạo qua API**, không qua UI. Chỉ thao tác UI cho đúng phần TC đang kiểm.
3. **Tên duy nhất**: tiền tố `E2E TAF` + hậu tố ngẫu nhiên (`uniq()`).
4. **Môi trường dùng chung thì phải dọn được**: mọi dữ liệu nhận ra được qua tiền tố hoặc tenant test.

## Các lớp dữ liệu

| Lớp | Là gì | Cách làm |
|---|---|---|
| ① Nền | Danh mục mặc định, menu, cấu hình hệ thống | Migration + `deploy/db/install.sh`, như hiện tại. Không chứa dữ liệu nghiệp vụ. |
| ② Cách ly | Hàng rào giữa các lần chạy | `ci`: mỗi run một tenant `E2E TAF <run-id>`. `dev`: tenant cố định `e2e-taf`. Dùng chính `CORE-C10` làm hộp cát. |
| ③ Từng test | Khách hàng, deal, bảng giá, lịch viếng thăm… | Factory trong `web/e2e/fixtures/` |
| ④ File mẫu | Excel import, ảnh viếng thăm | `web/e2e/assets/`, commit vào repo |
| ⑤ Phụ thuộc ngoài | Dify, GPS, giờ, email | Giả lập (bảng dưới) |

## Factory

Factory kế thừa các hàm có sẵn (`createCustomer`, `createDeal` trong `dl-helpers.ts`…), gom về `fixtures/` theo addon và có giá trị mặc định hợp lệ:

```ts
// fixtures/dl.ts
export async function deal(req: APIRequestContext, o: Partial<DealInput> = {}) {
  const cust = o.customerId ?? (await customer(req)).id;
  return api(req, 'post', '/dl/deal/save', {
    name: uniq('E2E TAF deal'),
    customerId: cust,
    stage: 'Tiếp cận',
    ...o,
  });
}
```

```ts
// dùng trong script
const d = await fx.deal(request, { stage: 'Đàm phán', contacts: 2 });
```

- Factory gọi API bằng token của persona phù hợp (mặc định `tenant-admin` của tenant test).
- Claude dịch "Tiền điều kiện" trong TC sang lời gọi factory. Thiếu factory thì Claude thêm vào `fixtures/` trong cùng PR.

## Dữ liệu trong TC

| Trong TC | Sinh thành |
|---|---|
| "Tiền điều kiện" (mô tả trạng thái) | Lời gọi factory trong phần chuẩn bị của test |
| Bảng "Dữ liệu kiểm tra" | Mỗi dòng một test, tên test kèm số dòng |
| Giá trị cụ thể trong bước ("nhập 100.000") | Hằng trong script |

```ts
for (const [i, row] of rows.entries()) {
  test(`TC-DL-F05-002 DL-F05-US02-E1 #${i + 1}: SL=${row.qty}`, async ({ page }) => { /* … */ });
}
```

## Giả lập phụ thuộc ngoài

| Phụ thuộc | Cách giả |
|---|---|
| Dify (CORE-C12) | Server giả trên `127.0.0.1` như `ai-helpers.ts` đang làm |
| GPS (FS check-in) | `context.setGeolocation({ latitude, longitude, accuracy })` + `permissions: ['geolocation']` |
| Giờ hệ thống (hạn báo cáo, lịch định kỳ) | `page.clock` của Playwright cho phía trình duyệt; phía server dùng dữ liệu có ngày tương đối |
| Email định kỳ (CORE-C13-F05) | SMTP giả (vd Mailpit) trong `env.up`, kiểm qua API của nó |
| Upload ảnh từ camera | `setInputFiles` với file trong `assets/` |

## Dọn dẹp

| Môi trường | Cách dọn |
|---|---|
| `ci` | Không cần. DB bị bỏ sau run. |
| `dev` | Sau run: xoá theo tiền tố bằng helper dọn dẹp (như `TestDlE2ECleanup`), hoặc xoá tenant test nếu `CORE-C10` hỗ trợ. Hằng tuần: dọn toàn bộ tenant `e2e-taf`. |
| `local` | `pnpm e2e:cleanup` gọi cùng helper |

`lib/cleanup` của `taf` giữ **sổ đăng ký**: mỗi factory ghi lại bản ghi đã tạo. Helper theo tiền tố là lưới an toàn.

### Tự dọn theo từng test

Factory được bọc bằng cơ chế fixture của Playwright (`test.extend`). Sổ đăng ký được tạo cho mỗi test, và phần dọn dẹp **tự chạy sau test, kể cả khi test fail**. Script không phải tự viết `afterAll`.

```ts
// fixtures/index.ts
export const test = base.extend<{ fx: Factories }>({
  fx: async ({ request }, use) => {
    const created = new CleanupRegistry();
    await use(makeFactories(request, created));   // ← test chạy ở đây
    await created.deleteAll();                     // ← tự chạy sau test
  },
});
```

```ts
// generated/DL-F05.spec.ts — import test từ fixtures, không từ @playwright/test
import { test, expect } from '../fixtures';

test('TC-DL-F05-001 DL-F05-US01: thêm dòng sản phẩm', async ({ page, fx }) => {
  const d = await fx.deal({ stage: 'Tiếp cận' });
  // …
});                                                // d tự bị xoá
```

- Trên `ci`, `deleteAll()` có thể tắt (`cleanup: false` trong `env/ci.yml`) cho nhanh, vì DB bị bỏ sau run.
- Xoá theo thứ tự ngược với lúc tạo (deal trước, khách hàng sau), để không vướng ràng buộc xoá của `CORE-C08-F03`.
- Xoá lỗi thì chỉ ghi cảnh báo, không làm fail test. Helper theo tiền tố sẽ dọn sau.

## Chạy song song

`playwright.config.ts` hiện đặt `fullyParallel: false`. Khi mọi test mới dùng tên duy nhất và không phụ thuộc nhau, có thể bật `workers > 1` cho `generated/`, còn 39 spec cũ vẫn chạy tuần tự (project riêng).
