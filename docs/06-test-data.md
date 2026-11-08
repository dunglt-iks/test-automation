# 06 — Test data: phần của dự án

TAF không tạo dữ liệu test. Script sinh ra gọi **factory và fixture của dự án**, theo cách dự án mô tả trong `scripts.guide`. Tài liệu này là các nguyên tắc nên theo để script sinh ra chạy ổn định, và là những gì Claude được dặn khi viết script.

## Nguyên tắc

1. **Mỗi test tự tạo dữ liệu nó cần.** Không dựa vào dữ liệu test khác để lại, không dựa vào thứ tự chạy.
2. **Tạo qua API**, không qua UI. Chỉ thao tác UI cho đúng phần TC đang kiểm.
3. **Tên duy nhất, có tiền tố nhận diện** (vd `E2E <chuỗi ngẫu nhiên>`), để chạy song song và dọn được.
4. **Tự dọn sau test** khi chạy trên môi trường dùng chung.

TC chỉ mô tả **trạng thái** cần có ("đơn có 2 dòng, đã duyệt"), không mô tả cách tạo. Script dùng factory của dự án để tạo trạng thái đó.

## Fixture tự dọn (gợi ý)

```ts
// e2e/fixtures.ts của dự án
export const test = base.extend<{ fx: Factories }>({
  fx: async ({ request }, use) => {
    const created: (() => Promise<void>)[] = [];
    await use(makeFactories(request, created));           // test chạy ở đây
    for (const del of created.reverse()) await del().catch(() => {});   // dọn, kể cả khi test fail
  },
});
```

Script sinh ra import `test` từ fixture của dự án, không từ `@playwright/test`. Hướng dẫn trong `scripts.guide` phải nói rõ điều này.

## Bảng "Dữ liệu kiểm tra"

TC có bảng dữ liệu thì script sinh **một test cho mỗi dòng**, tên test có số dòng:

```ts
for (const [i, row] of rows.entries())
  test(`TC-DM-F01-004 số lượng không hợp lệ [${i + 1}] ${row.qty}`, async ({ page }) => { /* … */ });
```

## Phụ thuộc ngoài

Dịch vụ ngoài (AI, bản đồ, email, thanh toán), giờ hệ thống, vị trí: giả lập trong phần của dự án (`page.route`, `clock`, `geolocation`, server giả). Hướng dẫn của dự án liệt kê sẵn để Claude dùng đúng.
