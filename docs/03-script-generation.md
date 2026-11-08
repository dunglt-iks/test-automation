# 03 — Sinh test script

## 1. Ai lo gì

| TAF | Dự án |
|---|---|
| Prompt [`prompts/script.md`](../prompts/script.md): đọc TC + hướng dẫn của dự án → viết script | Hướng dẫn viết test (`scripts.guide`): import, persona, fixture dữ liệu, page object có sẵn, cách chờ |
| `plan-gen`: chọn feature cần sinh. `check-script`: script khớp TC. `check-paths`: chỉ ghi chỗ được phép. `rehash` | Page object, fixture, Playwright config, `globalSetup` |
| Action `generate`: chạy Claude, kiểm tra, commit vào PR | Lệnh lint (`scripts.lint`), target để chạy thử (`scripts.verifyTarget`) |

Ví dụ đầy đủ phần của dự án: [`examples/demo/e2e/`](../examples/demo/e2e/) và [`TAF-GUIDE.md`](../examples/demo/e2e/TAF-GUIDE.md) của nó.

## 2. Khi nào sinh

`taf plan-gen <mã…>` cho mỗi feature:

| Kết quả | Khi |
|---|---|
| `new` | TC đã duyệt, chưa có `<scripts.dir>/<MÃ><ext>` |
| `update` | Dòng `@taf-source` của script lệch hash TC hiện tại (TC đã đổi) |
| `ok` | Script khớp TC |
| `skip` | Chưa có TC, TC còn lỗi lint, hoặc TC chưa duyệt |

Chỉ TC đã duyệt mới được sinh script. Hash tính trên toàn bộ file TC (bỏ khoảng trắng cuối dòng).

## 3. Luật của script (`check-script` kiểm)

1. Dòng đầu: `// @taf-source <đường dẫn TC> sha256:<hash>` (do `taf rehash <MÃ>` ghi).
2. Mỗi TC không `[DEPRECATED]` có ít nhất một `test("<mã TC> …")`. TC có bảng "Dữ liệu kiểm tra" → một test mỗi dòng, cùng mã TC.
3. Không có test cho TC lạ hoặc TC đã `[DEPRECATED]`. Không `test.only`.
4. Không chứa mẫu trong `scripts.forbid` (vd `page\.locator\(` để locator chỉ nằm trong page object, `waitForTimeout\(`). Dòng comment được bỏ qua.

Người sửa tay script (hoặc sửa TC mà không cần sinh lại) chạy `taf rehash <MÃ>` để lần sau không bị coi là lệch.

## 4. Claude viết script thế nào

Theo [`prompts/script.md`](../prompts/script.md):

| Bước | Nguồn |
|---|---|
| Hiểu ý định | TC (tiền điều kiện, bước, kết quả mong đợi) và phần spec TC trỏ tới |
| Cách viết | Hướng dẫn của dự án (`scripts.guide`), luật cao nhất |
| Thao tác giao diện | Page object có sẵn. Thiếu thì bổ sung page object (nếu nằm trong `allowedPaths`) |
| Tìm phần tử | Đọc code giao diện của app (chỉ đọc) |
| Chạy thử | `taf run --target <verifyTarget> <MÃ>`, sửa lỗi script tối đa 3 vòng |

Nguyên tắc: **không sửa script cho khớp app khi app làm khác TC.** Kết quả mong đợi luôn theo TC; test đó để fail và được báo là nghi bug.

## 5. Phạm vi file Claude được ghi

**Claude không sửa code ứng dụng**, spec, TC (khi sinh script), cấu hình test. Chỉ ghi vào `scripts.allowedPaths`.

Cưỡng chế hai lớp:

1. **Công cụ của Claude** trong action `generate`: chỉ cho đọc/ghi file và chạy `taf`, `npx playwright`.
2. **Kiểm tra sau**: `taf check-paths` so mọi file đã đổi (kể cả file mới, kể cả file ngoài thư mục dự án) với `allowedPaths`. Có file ngoài danh sách → bước fail, không commit.

## 6. Action `generate`

```yaml
- uses: ./.taf/actions/generate
  with:
    features: ${{ needs.detect.outputs.features }}
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

1. `plan-gen` → không có gì cần sinh thì dừng. Thiếu token → cảnh báo, dừng (không fail).
2. Cài Claude Code (ghim phiên bản), chạy `claude -p "Đọc .taf/prompts/script.md và làm theo cho: <mã…>"`.
3. `check-paths`, `check-script`, `lint-script`. Lỗi → fail, không commit.
4. Commit `test(e2e): sinh script <mã…> [taf]` và push lên nhánh PR. Job phải checkout đúng nhánh PR (`ref: ${{ github.head_ref }}`) và có `contents: write`.

TAF phải nằm ở `<root>/.taf` (checkout hoặc symlink), vì prompt gọi `node .taf/cli/bin/taf.mjs`.
