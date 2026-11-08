// Page object: DM-F02-SCR01 — Tạo đơn hàng.
import { expect } from "@playwright/test";

export class OrderFormPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.customer = page.getByLabel("Khách hàng"); // ①
    this.product = page.getByLabel("Sản phẩm"); // ②
    this.qty = page.getByLabel("Số lượng"); // ③
    this.price = page.getByLabel("Đơn giá"); // ④
    this.discount = page.getByLabel("Chiết khấu (%)"); // ⑤
    this.total = page.getByTestId("form-total"); // ⑥
    this.saveButton = page.getByRole("button", { name: "Lưu" }); // ⑦
    this.cancelButton = page.getByRole("button", { name: "Huỷ" }); // ⑧
  }

  async open() {
    await this.page.goto("/orders/new");
    await expect(this.total).toBeVisible();
  }

  /** Lỗi hiện dưới ô: customer | product | qty | price | discount */
  error(field) {
    return this.page.getByTestId(`err-${field}`);
  }

  /** Điền các ô được truyền (giá trị dạng chuỗi hoặc số), rồi chờ thành tiền tính lại. */
  async fill({ customer, product, qty, price, discount } = {}) {
    if (customer !== undefined) await this.customer.fill(String(customer));
    if (product !== undefined) await this.product.fill(String(product));
    for (const [loc, v] of [
      [this.qty, qty],
      [this.price, price],
      [this.discount, discount],
    ]) {
      if (v === undefined) continue;
      const recalc = this.page.waitForResponse((r) => r.url().endsWith("/api/calc"));
      await loc.fill(String(v));
      await recalc;
    }
  }

  async save() {
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }
}
