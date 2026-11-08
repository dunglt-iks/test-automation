// Phần của dự án: test dùng chung. Script sinh ra import { test, expect, persona } từ đây.
//   fx.order({...})  tạo đơn qua API bằng phiên của persona hiện tại, tự xoá sau test
//   fx.uniq("Khách") tên duy nhất "E2E Khách 3k9x…"
import { test as base, expect } from "@playwright/test";
import { persona } from "./personas.mjs";

export { expect, persona };

export const test = base.extend({
  fx: async ({ page }, use) => {
    const created = [];
    const fx = {
      uniq: (label = "") =>
        `E2E ${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.replace(/\s+/g, " "),
      /** Tạo đơn qua API. Mặc định: SL 1, đơn giá 100000, CK 0. */
      async order(o = {}) {
        const data = { product: "Sản phẩm E2E", qty: 1, price: 100000, discount: 0, ...o };
        data.customer ??= fx.uniq("Khách");
        const res = await page.request.post("/api/orders", { data });
        expect(res.status(), await res.text()).toBe(201);
        const rec = await res.json();
        created.push(rec.id);
        return rec;
      },
    };
    await use(fx);
    for (const id of created.reverse())
      await page.request.delete(`/api/test/orders/${id}`).catch(() => {});
  },
});
