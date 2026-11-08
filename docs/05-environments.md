# 05 — Môi trường, tài khoản, vai trò

## 1. Các môi trường

| Môi trường | App ở đâu | Dữ liệu | Dùng cho |
|---|---|---|---|
| `ci` (mặc định) | Dựng mới trong job: Postgres, Redis, BE `:8090`, FE `:8001`, đúng commit của PR | DB trắng, bỏ đi sau run | Mọi PR. Ổn định nhất. |
| `dev` | VPS Dev, bản `sale-tools` vừa deploy | Dùng chung với người khác | Smoke sau deploy, hồi quy hằng đêm |
| `local` | Máy dev | DB local | Viết, sửa, debug test |
| `prod` | — | — | **Không chạy test ghi dữ liệu.** Nếu cần chỉ smoke chỉ đọc. |

Chọn môi trường bằng biến `E2E_ENV` (mặc định `ci`):

```bash
E2E_ENV=dev pnpm exec playwright test generated/DL-F05.spec.ts
```

## 2. Cấu hình

Phần công khai commit vào `web/e2e/env/<tên>.yml`. Phần bí mật chỉ nằm trong secret hoặc biến môi trường local.

```yaml
# web/e2e/env/ci.yml
baseUrl: http://localhost:8001
apiUrl:  http://localhost:8001/admin
tenant:  { mode: per-run }                 # mỗi run một tenant riêng
bootstrap:
  login: admin@mycom.vn                    # seed của install.sh
  passwordEnv: E2E_CI_ADMIN_PASSWORD
```

```yaml
# web/e2e/env/dev.yml
baseUrl: https://<dev-host>
apiUrl:  https://<dev-host>/admin
tenant:  { mode: shared, code: e2e-taf }   # một tenant cố định cho test
bootstrap:
  loginEnv: E2E_DEV_ADMIN_LOGIN
  passwordEnv: E2E_DEV_ADMIN_PASSWORD
```

- `playwright.config.ts` đọc file theo `E2E_ENV`. Biến cũ `E2E_BASE_URL`, `E2E_ADMIN_LOGIN`, `E2E_ADMIN_PASSWORD` vẫn được ưu tiên nếu có, để 39 spec cũ chạy như trước.
- Local: đặt bí mật trong `web/.env.e2e.local` (gitignore).
- Gói Free không có *Environments* cho repo private, nên secret đặt tên theo tiền tố môi trường: `E2E_CI_*`, `E2E_DEV_*`.

### Cài đặt riêng cho môi trường `ci`

Các chỉnh sửa `config.yaml` hiện có trong job `e2e-test` của `ci.yml` (cổng `:8090`, tắt rate limit, `aiwk.secretKey`, `allowNetworks` cho Dify giả) chuyển vào `deploy/ci/e2e-env-up.sh`, để workflow nào cũng dựng môi trường giống nhau.

## 3. Persona: khai báo, tự tạo

Không duy trì tài khoản test bằng tay. Persona khai báo trong `web/e2e/personas.yml`:

```yaml
sale:
  role: E2E Sale
  menus: [cm, dl, fs]
  dataScope: self
sales-manager:
  role: E2E Quản lý
  menus: [cm, dl, fs, fs-team]
  dataScope: dept
tenant-admin:
  role: Quản trị đơn vị             # vai trò có sẵn khi tạo tenant
operator:
  platform: true                    # tài khoản bootstrap của nền tảng
other-tenant-sale:                  # kiểm cách ly giữa đơn vị (CORE-C10)
  tenant: second
  role: E2E Sale
```

### Luồng `globalSetup` (chạy một lần trước toàn bộ test)

```
1. Đọc env/<E2E_ENV>.yml + secret bootstrap
2. Đăng nhập bằng tài khoản bootstrap (platform admin)
3. Tạo / đảm bảo tenant test (per-run: "E2E TAF <run-id>"; shared: e2e-taf)
4. Tạo / đảm bảo vai trò, menu, phạm vi dữ liệu, phòng ban theo personas.yml
5. Tạo / đảm bảo tài khoản cho mỗi persona (mật khẩu ngẫu nhiên, giữ trong bộ nhớ)
6. Mỗi persona đăng nhập một lần → lưu .auth/<persona>.json (storageState, gitignore)
```

Bước 3–5 **idempotent**: chạy lại trên `dev` không sinh trùng.

### Dùng trong test

```ts
test.use({ storageState: persona('sale') });          // cả file

test('TC-DL-F01-007 DL-F01-US02-E3: quản lý thấy deal của cấp dưới', async ({ browser }) => {
  const mgr = await browser.newContext({ storageState: persona('sales-manager') });
  // …
});
```

TC markdown ghi `persona:` ở frontmatter hoặc từng TC. Claude ánh xạ sang `persona('<tên>')`. TC kiểm quyền, phạm vi dữ liệu hoặc cách ly tenant phải ghi persona rõ ràng.

## 4. Quy tắc

- Chỉ **một** tài khoản bootstrap cho mỗi môi trường nằm trong secret. Mọi tài khoản khác do `globalSetup` tạo.
- Mật khẩu persona không ghi ra file hay log. Chỉ `storageState` được lưu, và không commit.
- Persona mới (vai trò mới trong spec) thêm vào `personas.yml` trong cùng PR với TC cần nó.
