# Hướng dẫn viết test cho dự án demo

Claude đọc file này trước khi sinh script từ test case (`scripts.guide` trong `taf.config.yml`).

## File và tên

- Mỗi feature một file: `e2e/generated/<MÃ>.spec.mjs` (JavaScript ESM, không TypeScript).
- Import duy nhất từ fixture và page object của dự án:

```js
import { test, expect, persona } from "../fixtures.mjs";
import { OrderListPage } from "../pages/OrderListPage.mjs";
import { OrderFormPage } from "../pages/OrderFormPage.mjs";
```

Không import `@playwright/test` trực tiếp.

## Persona

TC ghi `persona: <tên>` (frontmatter hoặc từng TC). Ánh xạ:

```js
test.use({ storageState: persona("sale") });                 // cả file, theo persona của frontmatter
test.describe(() => { test.use({ storageState: persona("manager") }); test("…", …); });  // TC có persona khác
```

Có sẵn: `sale`, `sale-2`, `manager` (xem `e2e/personas.yml`). Không đăng nhập trong test.

## Dữ liệu

- Tạo đơn bằng `fx.order({ customer, product, qty, price, discount })` (qua API, bằng phiên của persona hiện tại, tự xoá sau test). Trả về `{ id, customer, total, … }`.
- Tên khách hàng luôn duy nhất: `fx.uniq("Khách")`. Các test chạy song song và dùng chung app, nên **luôn tìm theo tên khách hàng duy nhất** trước khi kiểm danh sách.
- Cần đơn do persona khác tạo: dùng `browser.newContext({ storageState: persona("sale-2") })` rồi gọi `ctx.request.post("/api/orders", { data })`; nhớ xoá bằng `ctx.request.delete("/api/test/orders/<id>")` và đóng context.
- Trạng thái "Chưa có đơn hàng" không dựng được khi chạy song song (người khác có thể đang có đơn). Kiểm bằng persona `sale-2` khi persona này chưa tạo đơn nào trong test đó, hoặc dùng tìm kiếm: chuỗi tìm không khớp đơn nào → *Không tìm thấy đơn phù hợp*.

## Page object

| Màn hình | Class | Có sẵn |
|---|---|---|
| DM-F01-SCR01 | `OrderListPage` | `open()`, `searchFor(text)`, `row(id)`, `totalOf(id)`, `firstRow()`, `deleteButton(id)`, `confirmDelete()`, `cancelDelete()`, `startCreate()`, `search`, `addButton`, `table`, `empty`, `ownerHeader`, `actionHeader`, `toast`, `confirmDialog` |
| DM-F02-SCR01 | `OrderFormPage` | `open()`, `fill({...})`, `save()`, `cancel()`, `error(field)`, `customer`, `product`, `qty`, `price`, `discount`, `total`, `saveButton`, `cancelButton` |

- Locator **chỉ** nằm trong page object. Script không gọi `page.locator`, `page.getBy…`. Thiếu locator thì thêm vào page object (được phép sửa `e2e/pages/`).
- Không dùng `waitForTimeout`. Chờ bằng `expect(...)` (tự chờ) hoặc các hàm page object đã chờ sẵn.

## Kết quả mong đợi

- Mỗi ô "Kết quả mong đợi" của TC thành ít nhất một `expect`.
- Số tiền hiển thị theo `vi-VN`: `45.000`. So sánh chuỗi đúng như trên màn hình (`toHaveText("45.000")`).
- Thông báo: `expect(list.toast).toHaveText("Đã tạo đơn #12")`.
