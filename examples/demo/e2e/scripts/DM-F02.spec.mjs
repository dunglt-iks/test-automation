// @taf-source e2e/testcases/DM/DM-F02.md sha256:dd4e3748ab69f0f3
import { test, expect, persona } from "../fixtures.mjs";
import { OrderListPage } from "../pages/OrderListPage.mjs";
import { OrderFormPage } from "../pages/OrderFormPage.mjs";

test.use({ storageState: persona("sale") });

test("TC-DM-F02-001 Tạo đơn không chiết khấu", async ({ page, fx }) => {
  const k = fx.uniq("K");
  const list = new OrderListPage(page);
  const form = new OrderFormPage(page);
  await list.open();

  await list.startCreate();
  await expect(form.total).toBeVisible();

  await form.fill({ customer: k, product: "Bút bi", qty: 3, price: 12500 });
  await expect(form.total).toHaveText("37.500");

  await form.save();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(list.toast).toHaveText(/^Đã tạo đơn #\d+$/);

  await list.searchFor(k);
  await expect(list.rows()).toHaveCount(1);
  await expect(list.firstRow()).toContainText("Bút bi");
  await expect(list.firstRow()).toContainText("37.500");
});

test("TC-DM-F02-002 Tạo đơn có chiết khấu", async ({ page, fx }) => {
  const k = fx.uniq("K");
  const list = new OrderListPage(page);
  const form = new OrderFormPage(page);
  await form.open();

  await form.fill({
    customer: k,
    product: "Vở",
    qty: 10,
    price: 5000,
    discount: 10,
  });
  await expect(form.total).toHaveText("45.000");

  await form.save();
  await expect(page).toHaveURL(/\/orders$/);
  await list.searchFor(k);
  await expect(list.rows()).toHaveCount(1);
  await expect(list.firstRow()).toContainText("10%");
  await expect(list.firstRow()).toContainText("45.000");
});

const totals = [
  { qty: "1", price: "100000", discount: "0", expected: "100.000" },
  { qty: "2.5", price: "100000", discount: "10", expected: "225.000" },
  { qty: "3", price: "33333", discount: "5", expected: "94.999" },
  { qty: "12", price: "1000", discount: "50", expected: "6.000" },
];
for (const [i, row] of totals.entries()) {
  test(`TC-DM-F02-003 Thành tiền tính theo DM-BR01 và làm tròn [${i + 1}] ${row.qty} × ${row.price} − ${row.discount}%`, async ({
    page,
  }) => {
    const form = new OrderFormPage(page);
    await form.open();
    await form.fill({ qty: row.qty, price: row.price, discount: row.discount });
    await expect(form.total).toHaveText(row.expected);
  });
}

test("TC-DM-F02-004 Huỷ tạo đơn", async ({ page, fx }) => {
  const k = fx.uniq("K");
  const list = new OrderListPage(page);
  const form = new OrderFormPage(page);
  await list.open();
  await list.startCreate();

  await form.fill({ customer: k });
  await form.cancel();
  await expect(page).toHaveURL(/\/orders$/);

  await list.searchFor(k);
  await expect(list.empty).toHaveText("Không tìm thấy đơn phù hợp");
});

const badQty = [{ qty: "0" }, { qty: "-1" }, { qty: "" }];
for (const [i, row] of badQty.entries()) {
  test(`TC-DM-F02-005 Số lượng không hợp lệ [${i + 1}] "${row.qty}"`, async ({
    page,
    fx,
  }) => {
    const form = new OrderFormPage(page);
    await form.open();
    await form.fill({
      customer: fx.uniq("K"),
      product: "Bút",
      price: 1000,
      qty: row.qty,
    });
    await form.save();
    await expect(form.error("qty")).toHaveText("Số lượng phải lớn hơn 0");
    await expect(page).toHaveURL(/\/orders\/new$/);
  });
}

test("TC-DM-F02-006 Thiếu khách hàng", async ({ page }) => {
  const form = new OrderFormPage(page);
  await form.open();
  await form.fill({ product: "Bút", qty: 1, price: 1000 });
  await form.save();
  await expect(form.error("customer")).toHaveText("Nhập tên khách hàng");
  await expect(page).toHaveURL(/\/orders\/new$/);
});

const badDiscount = [{ discount: "-5" }, { discount: "101" }];
for (const [i, row] of badDiscount.entries()) {
  test(`TC-DM-F02-007 Chiết khấu ngoài khoảng 0–100 [${i + 1}] ${row.discount}`, async ({
    page,
    fx,
  }) => {
    const form = new OrderFormPage(page);
    await form.open();
    await form.fill({
      customer: fx.uniq("K"),
      product: "Bút",
      qty: 1,
      price: 1000,
      discount: row.discount,
    });
    await form.save();
    await expect(form.error("discount")).toHaveText("Chiết khấu từ 0 đến 100");
    await expect(page).toHaveURL(/\/orders\/new$/);
  });
}

test("TC-DM-F02-008 Giá trị mặc định của form", async ({ page }) => {
  const form = new OrderFormPage(page);
  await form.open();
  await expect(form.qty).toHaveValue("1");
  await expect(form.price).toHaveValue("0");
  await expect(form.discount).toHaveValue("0");
  await expect(form.total).toHaveText("0");
});
