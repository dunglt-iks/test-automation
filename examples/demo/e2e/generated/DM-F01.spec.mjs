// @taf-source docs/testcases/DM/DM-F01.md sha256:94f813d730acddb7
import { test, expect, persona } from "../fixtures.mjs";
import { OrderListPage } from "../pages/OrderListPage.mjs";

test.use({ storageState: persona("sale") });

/** Tạo đơn bằng phiên của persona khác (theo TAF-GUIDE), xoá sau test. */
async function orderAs(browser, name, data, cleanups) {
  const ctx = await browser.newContext({ storageState: persona(name) });
  const res = await ctx.request.post("/api/orders", {
    data: {
      product: "Sản phẩm E2E",
      qty: 1,
      price: 100000,
      discount: 0,
      ...data,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const rec = await res.json();
  cleanups.push(async () => {
    await ctx.request.delete(`/api/test/orders/${rec.id}`).catch(() => {});
    await ctx.close();
  });
  return rec;
}

let cleanups = [];
test.afterEach(async () => {
  for (const c of cleanups.reverse()) await c();
  cleanups = [];
});

test("TC-DM-F01-001 Sale thấy đơn của mình, không thấy đơn của sale khác", async ({
  page,
  browser,
  fx,
}) => {
  const k1 = fx.uniq("K1");
  const k2 = fx.uniq("K2");
  const mine = await fx.order({
    customer: k1,
    qty: 2,
    price: 50000,
    discount: 0,
  });
  await orderAs(browser, "sale-2", { customer: k2 }, cleanups);
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(k1);
  await expect(list.row(mine.id)).toBeVisible();
  await expect(list.totalOf(mine.id)).toHaveText("100.000");

  await list.searchFor(k2);
  await expect(list.empty).toHaveText("Không tìm thấy đơn phù hợp");
});

test("TC-DM-F01-002 Tìm theo khách hàng không phân biệt hoa thường", async ({
  page,
  fx,
}) => {
  const x = fx.uniq("X");
  const alpha = await fx.order({ customer: `${x} Alpha` });
  const beta = await fx.order({ customer: `${x} Beta` });
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(`${x} alpha`.toLowerCase());
  await expect(list.rows()).toHaveCount(1);
  await expect(list.row(alpha.id)).toBeVisible();
  await expect(list.row(beta.id)).toHaveCount(0);
});

test("TC-DM-F01-003 Tìm không ra", async ({ page, fx }) => {
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(fx.uniq("không khớp"));
  await expect(list.table).toBeHidden();
  await expect(list.empty).toHaveText("Không tìm thấy đơn phù hợp");
});

test.describe(() => {
  test.use({ storageState: persona("manager") });

  test("TC-DM-F01-004 Quản lý thấy đơn của sale, có cột Người tạo và Thao tác", async ({
    page,
    browser,
    fx,
  }) => {
    const k = fx.uniq("K");
    const o = await orderAs(browser, "sale", { customer: k }, cleanups);
    const list = new OrderListPage(page);
    await list.open();

    await list.searchFor(k);
    await expect(list.ownerHeader).toBeVisible();
    await expect(list.actionHeader).toBeVisible();
    await expect(list.row(o.id)).toBeVisible();
    await expect(list.cell(o.id, "sale")).toBeVisible();
    await expect(list.deleteButton(o.id)).toBeVisible();
  });

  test("TC-DM-F01-006 Quản lý xoá đơn", async ({ page, browser, fx }) => {
    const k = fx.uniq("K");
    const o = await orderAs(browser, "sale", { customer: k }, cleanups);
    const list = new OrderListPage(page);
    await list.open();

    await list.searchFor(k);
    await list.deleteButton(o.id).click();
    await expect(list.confirmDialog).toBeVisible();
    await expect(list.confirmTitle).toHaveText(`Xoá đơn #${o.id}?`);

    await list.confirmDelete();
    await expect(list.confirmDialog).toBeHidden();
    await expect(list.toast).toHaveText(`Đã xoá đơn #${o.id}`);
    await expect(list.empty).toHaveText("Không tìm thấy đơn phù hợp");
  });

  test("TC-DM-F01-007 Huỷ xoá đơn", async ({ page, browser, fx }) => {
    const k = fx.uniq("K");
    const o = await orderAs(browser, "sale", { customer: k }, cleanups);
    const list = new OrderListPage(page);
    await list.open();

    await list.searchFor(k);
    await list.deleteButton(o.id).click();
    await list.cancelDelete();
    await expect(list.confirmDialog).toBeHidden();
    await expect(list.row(o.id)).toBeVisible();
  });
});

test("TC-DM-F01-005 Sale không thấy cột Người tạo, Thao tác và nút Xoá", async ({
  page,
  fx,
}) => {
  const k = fx.uniq("K");
  const o = await fx.order({ customer: k });
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(k);
  await expect(list.row(o.id)).toBeVisible();
  await expect(list.ownerHeader).toBeHidden();
  await expect(list.actionHeader).toBeHidden();
  await expect(list.deleteButton(o.id)).toHaveCount(0);
});

test("TC-DM-F01-008 Đơn mới nhất ở trên, số tiền định dạng vi-VN", async ({
  page,
  fx,
}) => {
  const x = fx.uniq("X");
  const first = await fx.order({
    customer: `${x} 1`,
    qty: 1,
    price: 1000,
    discount: 0,
  });
  const second = await fx.order({
    customer: `${x} 2`,
    qty: 1,
    price: 1234567,
    discount: 10,
  });
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(x);
  await expect(list.rows()).toHaveCount(2);
  await expect(list.rows().nth(0)).toHaveAttribute(
    "data-testid",
    `order-row-${second.id}`,
  );
  await expect(list.cell(second.id, "10%")).toBeVisible();
  await expect(list.totalOf(second.id)).toHaveText("1.111.110");
  await expect(list.rows().nth(1)).toHaveAttribute(
    "data-testid",
    `order-row-${first.id}`,
  );
  await expect(list.totalOf(first.id)).toHaveText("1.000");
});
