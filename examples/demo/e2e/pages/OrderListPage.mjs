// Page object: DM-F01-SCR01 — Danh sách đơn. Mọi locator của màn này nằm ở đây.
import { expect } from "@playwright/test";

export class OrderListPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.search = page.getByTestId("orders-search"); // ①
    this.addButton = page.getByTestId("orders-add"); // ②
    this.table = page.getByTestId("orders-table");
    this.empty = page.getByTestId("orders-empty");
    this.ownerHeader = page.getByRole("columnheader", { name: "Người tạo" }); // ③
    this.actionHeader = page.getByRole("columnheader", { name: "Thao tác" }); // ④
    this.toast = page.getByRole("status");
    this.confirmDialog = page.getByRole("dialog");
    this.currentUser = page.getByTestId("current-user");
  }

  async open() {
    await this.page.goto("/orders");
    await expect(this.currentUser).not.toBeEmpty();
  }

  /** Gõ vào ô tìm và chờ danh sách tải lại. */
  async searchFor(text) {
    const reloaded = this.page.waitForResponse((r) => r.url().includes("/api/orders?"));
    await this.search.fill(text);
    await reloaded;
  }

  row(id) {
    return this.page.getByTestId(`order-row-${id}`);
  }

  totalOf(id) {
    return this.page.getByTestId(`order-total-${id}`);
  }

  /** Các dòng đơn đang hiện, theo thứ tự trên màn hình. */
  rows() {
    return this.table.locator("tbody tr");
  }

  /** Dòng đầu tiên của bảng (đơn mới nhất). */
  firstRow() {
    return this.rows().first();
  }

  /** Ô có đúng chữ `text` trong dòng đơn `id`. */
  cell(id, text) {
    return this.row(id).getByRole("cell", { name: text, exact: true });
  }

  /** Tiêu đề hộp xác nhận xoá. */
  get confirmTitle() {
    return this.confirmDialog.getByRole("heading");
  }

  deleteButton(id) {
    return this.row(id).getByRole("button", { name: "Xoá" });
  }

  confirmDelete() {
    return this.confirmDialog.getByRole("button", { name: "Xoá" }).click();
  }

  cancelDelete() {
    return this.confirmDialog.getByRole("button", { name: "Huỷ" }).click();
  }

  async startCreate() {
    await this.addButton.click();
    await expect(this.page).toHaveURL(/\/orders\/new$/);
  }
}
