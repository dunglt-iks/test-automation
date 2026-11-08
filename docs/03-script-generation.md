# 03 — Sinh test script

## 1. Ngôn ngữ và công cụ

- **TypeScript** với `@playwright/test`. Repo đã dùng sẵn trong `web/e2e/`.
- Script sinh ra phải qua `tsc` và `playwright test --list` trước khi commit.

## 2. Tổ chức theo Page Object Model

```
web/e2e/
├── components/   ← component object: thành phần dùng chung của CORE-C07
│                   (ListTable, Dialog, Drawer, Select/DatePicker của Naive UI…)
├── pages/        ← page object: mỗi màn hình SCR trong FSD là một class
│   └── dl/deal-list.page.ts         (DL-F01-SCR01)
├── fixtures/     ← factory dữ liệu qua API, persona (xem 06)
├── generated/    ← script do bot sinh: CHỈ gọi pages/ + components/ + fixtures/
└── *.spec.ts     ← 39 spec viết tay hiện có, giữ nguyên
```

| Lớp | Chứa gì | Ai viết |
|---|---|---|
| components | Locator CSS của Naive UI (`.n-dialog`, `.n-data-table-tr`…), bọc **một lần duy nhất** | Người viết, Claude bổ sung khi cần |
| pages | Locator của màn hình, method = thao tác trong bảng component của FSD | Claude sinh/bổ sung, review cùng PR |
| generated | Từng TC: fixture → thao tác page → `expect` | Claude sinh |

Ví dụ:

```ts
// pages/dl/deal-list.page.ts — DL-F01-SCR01
export class DealListPage {
  constructor(private page: Page) {}
  readonly search = this.page.getByTestId('dl-f01-scr01-search');   // ①
  readonly addBtn = this.page.getByTestId('dl-f01-scr01-add');      // ③
  card = (id: number) => this.page.getByTestId(`deal-card-${id}`);

  async open() {
    await this.page.goto('/#/dl/dl_deal');
    await expect(this.search).toBeVisible();
  }
  async addDeal(name: string, customer: string) {
    await this.addBtn.click();
    const dlg = new Dialog(this.page);
    await dlg.select('Khách hàng', customer);
    await dlg.fill('Tên deal', name);
    await dlg.save();
  }
}
```

```ts
// generated/DL-F01.spec.ts
// @taf-source docs/testcases/DL/DL-F01.md sha256:91be…
test.use({ storageState: persona('sale') });

test('TC-DL-F01-001 DL-F01-US01: thêm deal', async ({ page, request }) => {
  const cust = await fx.customer(request);
  const list = new DealListPage(page);
  await list.open();
  await list.addDeal(uniq('E2E TAF deal'), cust.name);
  await expect(list.card(/* … */)).toBeVisible();
});
```

### Quy tắc bắt buộc (lint chặn)

1. Tên `test()` bắt đầu bằng mã TC, theo sau là mã truy vết: `'TC-DL-F01-001 DL-F01-US01: …'`.
2. Trong `generated/` **không dùng locator trực tiếp**, trừ trong `expect(...)` để kiểm kết quả.
3. Không dùng `waitForTimeout` (chờ cứng). Chờ bằng `expect` hoặc chờ response API.
4. Đầu file có `@taf-source <đường dẫn TC> sha256:<hash>` để biết khi nào cần sinh lại.
5. Không đăng nhập trong test. Dùng `persona()`.

## 3. Chiến lược locator

### Thứ tự ưu tiên

| # | Locator | Khi nào |
|---|---|---|
| 1 | `getByTestId('dl-f01-scr01-add')` | Luôn ưu tiên. Không vỡ khi đổi chữ hay đổi giao diện. |
| 2 | `getByRole('button', { name: /^(Add deal\|Thêm deal)$/ })` | Chưa có testid. Chấp nhận cả `vi` và `en`, như repo đang làm. |
| 3 | `getByPlaceholder`, `getByLabel` | Ô nhập chưa có testid |
| 4 | CSS (`.n-dialog`) | Phần tử nội bộ của Naive UI. **Chỉ được viết trong `components/`.** |

Hiện trạng repo: 653 `getByTestId`, 207 `getByRole`, 678 `locator()` CSS thô (phần lớn là class Naive UI). Script mới không thêm CSS thô ngoài `components/`.

### Quy ước `data-testid`

Mỗi thành phần trong bảng component của FSD (số ①②③ trên wireframe) có `data-testid`:

```
<screen-code viết thường>-<tên ngắn>          dl-f01-scr01-add
<screen-code>-<tên>-<id>   (phần tử lặp)      deal-card-12 (giữ tên đang có)
```

- Đưa quy ước này vào `/feature`: dev gắn testid theo bảng component khi code màn hình.
- Màn hình thiếu testid: Claude **không thêm** testid vào code (xem §5). Page object dùng locator bậc 2–3 làm tạm, đánh dấu `// TODO testid: dl-f01-scr01-add`. Report liệt kê các testid còn thiếu ([07 §3](07-bug-reporting.md)), dev bổ sung qua `/feature`. Khi testid đã có, lần sinh sau đổi sang `getByTestId`.

### Claude tìm locator thế nào

| Bước | Nguồn | Mục đích |
|---|---|---|
| ① Đọc spec | Wireframe, bảng component của SCR | Biết bước trong TC ứng với thành phần nào (③ = nút *Thêm*) |
| ② Đọc code | Route → file `.vue` của màn hình, `locale/{vi,en}.json` | Lấy `data-testid`, nhãn, placeholder, chữ hiển thị |
| ③ Đọc page object có sẵn | `pages/`, `components/` | Dùng lại method. Chỉ thêm method mới khi chưa có. |
| ④ Xem app thật | Aria snapshot lúc chạy thử | Bắt phần tử render động, dialog, giá trị thật |
| ⑤ Chạy và sửa | Trace khi fail | Sửa locator, tối đa 2 vòng |

## 4. Khi nào sinh lại script

| Tình huống | Hành động |
|---|---|
| TC mới | Sinh script mới |
| Hash TC khác `@taf-source` | Sinh lại các test của TC đã đổi, giữ nguyên test khác |
| TC `[DEPRECATED]` | Xoá test tương ứng |
| Script fail do locator (triage xác định) | Sửa page object hoặc script, không đổi TC |
| UI đổi, page object vỡ | Sửa page object, mọi script dùng nó tự đúng lại |

## 5. Phạm vi file Claude được sửa

**Claude (sinh TC, sinh script, triage) không được sửa bất kỳ file code nào của ứng dụng.** Chỉ được ghi vào:

| Được ghi | Không được ghi |
|---|---|
| `docs/testcases/**` | `server/**`, `web/src/**` (kể cả thêm `data-testid`) |
| `web/e2e/generated/**`, `pages/**`, `components/**`, `fixtures/**`, `assets/**` | `web/e2e/*.spec.ts` (spec viết tay), `*-helpers.ts` hiện có |
| `web/e2e/personas.yml` | `playwright.config.ts`, `globalSetup`, `env/*.yml`, `deploy/**`, `.github/**`, `package.json` |
| | `docs/features/**` (spec) |

Cưỡng chế hai lớp:
1. **Quyền của Claude:** bước gọi Claude cấu hình `permissions.allow` chỉ cho `Edit`/`Write` trong các đường dẫn được ghi, `deny` mọi đường dẫn khác.
2. **Kiểm tra sau:** `taf` so `git diff --name-only` với `scripts.allowedPaths` trong `taf.config.yml`. Có file ngoài danh sách thì huỷ toàn bộ thay đổi, job fail, không commit.

Cấu hình test (`playwright.config.ts`, `globalSetup`, `env/*.yml`) do người sửa qua PR thường.

Người review đọc script trong PR như đọc code thường. Test sinh ra có thể sửa tay. Sửa tay thì cập nhật hash để lần sau bot không ghi đè: chạy `taf rehash <file>`.
