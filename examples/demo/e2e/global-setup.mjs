// Phần của dự án: đăng nhập từng persona một lần, lưu storageState vào e2e/.auth/<persona>.json.
// App mẫu có sẵn tài khoản nên không phải tạo; app thật có thể tạo tài khoản/vai trò ở đây.
import { request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { personas } from "./personas.mjs";

const AUTH = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth");

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  fs.mkdirSync(AUTH, { recursive: true });
  for (const [name, p] of Object.entries(personas())) {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.post("/api/login", {
      data: { login: p.login, password: p.password },
    });
    if (!res.ok())
      throw new Error(`persona ${name}: đăng nhập lỗi ${res.status()}`);
    await ctx.storageState({ path: path.join(AUTH, `${name}.json`) });
    await ctx.dispose();
  }
}
