# Page object

Đặt page object (POM) của dự án ở thư mục này. Script do TAF sinh ra (`e2e/scripts/`) gọi page object thay vì viết locator trực tiếp; `scripts.forbid` trong `e2e/taf.config.yml` nên cấm `page.locator(` để giữ quy ước đó.

- Mỗi màn hình (hoặc khối dùng chung) một file, vd `OrderListPage.mjs`.
- Locator và thao tác UI chỉ nằm ở đây; assertion nghiệp vụ nằm trong script.
- Claude được thêm, sửa file ở đây khi sinh script hoặc triage (nằm trong `scripts.allowedPaths`). Người review đọc thay đổi ở đây như code thường.

Ví dụ: `.taf/examples/demo/e2e/pages/`.
