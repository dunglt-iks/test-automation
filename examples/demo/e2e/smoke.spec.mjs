// Test viết tay của dự án (không sinh từ TC). TAF vẫn chạy và báo cáo nó; mã spec trong tên test
// giúp báo cáo biết test này chạm tới phần nào.
import { test, expect, persona } from "./fixtures.mjs";

test("smoke DM-F01-SCR01: chưa đăng nhập thì về trang đăng nhập", async ({ page }) => {
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
});

test.describe(() => {
  test.use({ storageState: persona("sale") });
  test("smoke DM-F01-SCR01: sale mở được danh sách đơn", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByTestId("current-user")).toHaveText("Nhân viên bán hàng");
  });
});
