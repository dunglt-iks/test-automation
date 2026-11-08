// App mẫu "Đơn hàng" cho dự án demo của TAF. Node thuần, không thư viện, dữ liệu trong bộ nhớ.
//   node app/server.mjs                 → http://127.0.0.1:4310
//   PORT=…  DEMO_BUG=discount           → bug cài sẵn: bỏ chiết khấu khi số lượng ≥ 10
//   DEMO_TEST_API=1                     → bật API riêng cho test (/api/test/*)
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4310);
const BUG = process.env.DEMO_BUG || "";
const TEST_API = process.env.DEMO_TEST_API === "1";

const USERS = {
  sale: { password: "sale123", role: "sale", name: "Nhân viên bán hàng" },
  "sale-2": { password: "sale123", role: "sale", name: "Nhân viên 2" },
  manager: { password: "manager123", role: "manager", name: "Quản lý" },
};
/** @type {Map<string, string>} token → user */
const sessions = new Map();
/** @type {{ id: number, customer: string, product: string, qty: number, price: number, discount: number, total: number, owner: string, createdAt: string }[]} */
let orders = [];
let seq = 0;

/** Thành tiền = SL × đơn giá × (1 − CK%), làm tròn đến đồng. */
export function totalOf({ qty, price, discount }) {
  const d = qty >= 10 ? 0 : discount; // (PR thử: dev vô tình bỏ chiết khấu khi SL ≥ 10)
  return Math.round(qty * price * (1 - d / 100));
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function page(res, file) {
  send(
    res,
    200,
    fs.readFileSync(path.join(DIR, "pages", file), "utf8"),
    "text/html; charset=utf-8",
  );
}

function userOf(req) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "");
  const u = m && sessions.get(m[1]);
  return u ? { login: u, ...USERS[u] } : null;
}

async function body(req) {
  let s = "";
  for await (const c of req) s += c;
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

/** Lỗi kiểm dữ liệu đơn: { field: thông báo }. */
function validate(o) {
  const e = {};
  if (!String(o.customer || "").trim()) e.customer = "Nhập tên khách hàng";
  if (!String(o.product || "").trim()) e.product = "Nhập sản phẩm";
  if (!(Number(o.qty) > 0)) e.qty = "Số lượng phải lớn hơn 0";
  if (!(Number(o.price) >= 0)) e.price = "Đơn giá không hợp lệ";
  const d = Number(o.discount || 0);
  if (!(d >= 0 && d <= 100)) e.discount = "Chiết khấu từ 0 đến 100";
  return e;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const p = url.pathname;
  const user = userOf(req);

  if (p === "/health") return send(res, 200, { ok: true });
  if (p === "/login") return page(res, "login.html");
  if (p === "/api/login" && req.method === "POST") {
    const { login, password } = await body(req);
    const u = USERS[login];
    if (!u || u.password !== password)
      return send(res, 401, { error: "Sai tên đăng nhập hoặc mật khẩu" });
    const sid = crypto.randomBytes(16).toString("hex");
    sessions.set(sid, login);
    res.setHeader("set-cookie", `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
    return send(res, 200, { login, role: u.role, name: u.name });
  }

  if (TEST_API && p.startsWith("/api/test/")) {
    if (p === "/api/test/reset" && req.method === "POST") {
      orders = [];
      return send(res, 200, { ok: true });
    }
    const m = /^\/api\/test\/orders\/(\d+)$/.exec(p);
    if (m && req.method === "DELETE") {
      orders = orders.filter((o) => o.id !== Number(m[1]));
      return send(res, 200, { ok: true });
    }
  }

  if (!user) {
    if (p.startsWith("/api/"))
      return send(res, 401, { error: "Chưa đăng nhập" });
    res.writeHead(302, { location: "/login" });
    return res.end();
  }

  if (p === "/") {
    res.writeHead(302, { location: "/orders" });
    return res.end();
  }
  if (p === "/orders") return page(res, "orders.html");
  if (p === "/orders/new") return page(res, "order-form.html");
  if (p === "/api/me") return send(res, 200, user);
  if (p === "/api/logout" && req.method === "POST") {
    res.setHeader("set-cookie", "sid=; Path=/; Max-Age=0");
    return send(res, 200, { ok: true });
  }
  if (p === "/api/calc" && req.method === "POST") {
    const o = await body(req);
    return send(res, 200, {
      total: totalOf({
        qty: Number(o.qty) || 0,
        price: Number(o.price) || 0,
        discount: Number(o.discount) || 0,
      }),
    });
  }
  if (p === "/api/orders" && req.method === "GET") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const list = orders
      .filter((o) => user.role === "manager" || o.owner === user.login)
      .filter((o) => !q || o.customer.toLowerCase().includes(q))
      .sort((a, b) => b.id - a.id);
    return send(res, 200, list);
  }
  if (p === "/api/orders" && req.method === "POST") {
    const o = await body(req);
    const errors = validate(o);
    if (Object.keys(errors).length) return send(res, 422, { errors });
    const rec = {
      id: ++seq,
      customer: String(o.customer).trim(),
      product: String(o.product).trim(),
      qty: Number(o.qty),
      price: Number(o.price),
      discount: Number(o.discount || 0),
      total: 0,
      owner: user.login,
      createdAt: new Date().toISOString(),
    };
    rec.total = totalOf(rec);
    orders.push(rec);
    return send(res, 201, rec);
  }
  const del = /^\/api\/orders\/(\d+)$/.exec(p);
  if (del && req.method === "DELETE") {
    if (user.role !== "manager")
      return send(res, 403, { error: "Chỉ quản lý được xoá đơn" });
    const before = orders.length;
    orders = orders.filter((o) => o.id !== Number(del[1]));
    return send(res, before === orders.length ? 404 : 200, { ok: true });
  }
  send(res, 404, { error: "Không có" });
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(
    `demo app http://127.0.0.1:${PORT}${BUG ? ` (DEMO_BUG=${BUG})` : ""}${TEST_API ? " (test API bật)" : ""}`,
  ),
);
