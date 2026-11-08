# 07 — Triage, ghi bug, báo cáo

## 1. Luồng sau khi chạy

```
taf run (JSON report)
  └─ có test fail + có token AI → Claude triage (prompts/triage.md) → e2e/test-results/triage.json
                                    └─ lỗi script: sửa, chạy lại (taf run --merge), tối đa 2 vòng
taf report  → bảng theo feature, taf-result.json, comment PR
  └─ --file-bugs → bug app → issue theo fingerprint
```

Action `report` làm cả chuỗi này. Không có token AI thì bỏ qua triage; test fail lúc đó được coi là loại `--assume` (vd `app-bug`), để trống thì không ghi bug và báo "chưa phân loại".

## 2. Triage

| Loại | Dấu hiệu | Hành động |
|---|---|---|
| `app-bug` | App khác kết quả mong đợi của TC, TC đúng spec | Ghi issue |
| `script-bug` | Locator sai, thiếu chờ, dựng dữ liệu sai | Sửa script / page object, chạy lại; bản sửa được commit |
| `env` | App không lên, mạng, môi trường bẩn | Không ghi bug |
| `flaky` | Lúc pass lúc fail | Không ghi bug; báo cáo liệt kê test flaky (Playwright retry) |
| `tc-wrong` | TC mâu thuẫn spec | Không ghi bug; cần sửa TC |

Nguyên tắc: **triage không sửa code ứng dụng, không sửa script cho khớp app sai.**

`triage.json`: `[{ "test": "<tên test>", "class": "app-bug", "summary": "…", "fixed": false }]`.

## 3. Bug và vòng đời

- **Fingerprint** = mã TC (hoặc tên test nếu không có mã) + chữ ký lỗi: các dòng `Error`, `Locator`, `Expected` của thông báo, bỏ giá trị thực tế, số trong locator, mã `#N`, thời gian. Cùng lỗi ở lần chạy sau → cùng fingerprint.
- Issue: tiêu đề `[e2e] <tên test>`, nhãn `tracker.labels` + `feature:<MÃ>`, thân có test, TC, file:dòng, target, commit, link run (artifact có trace và ảnh), thông báo lỗi, phân tích của triage, và hai marker ẩn `taf:fp`, `taf:tc`.

| Tình huống | Hành động |
|---|---|
| Chưa có issue cùng fingerprint | Tạo |
| Có issue đang mở | Comment "vẫn lỗi ở …" |
| Có issue đã đóng (đã sửa) | Mở lại, comment lỗi |
| Chỉ có issue người đóng dạng *not planned* | Bỏ qua: tôn trọng quyết định "không phải bug / không sửa" |
| `--close-fixed`: issue đang mở mà mọi test của TC đó đã pass lần này | Comment rồi đóng |

Nhiều issue cùng fingerprint: chọn đang mở, rồi đã đóng *completed* mới nhất.

Lưu ý: bộ lọc nhãn của GitHub cập nhật chậm vài giây sau khi tạo issue. Hai lần `file-bugs` cách nhau dưới khoảng đó có thể tạo trùng; trong CI các lần chạy cách nhau nhiều phút nên không gặp.

`--close-fixed` nên bật ở run hồi quy trên nhánh phát triển (sau CD, hằng đêm), không bật ở PR (nhánh PR chưa phải code chung).

## 4. Báo cáo

`taf report` (comment PR chỉ một, sửa lại mỗi lần chạy):

```markdown
## E2E-TAF · ✘ 2 test fail · 22/24 pass

| Feature | Phủ spec | TC có test | Script (pass/fail/flaky/đã biết) | Test khác |
|---|---|---|---|---|
| DM-F01 Danh sách đơn hàng | 7/7 | 8/8 | 8/0/0/0 ✓ | 2/2 |
| DM-F02 Tạo đơn hàng | 7/7 | 8/8 | 12/2/0/0 ✘ | — |

### Test fail
▸ TC-DM-F02-002 Tạo đơn có chiết khấu — app-bug: SL 10 × 5.000, CK 10% ra 50.000 … · #1
```

| Cột | Nghĩa |
|---|---|
| Phủ spec | Mã bắt buộc (adapter) / mã TC đã phủ |
| TC có test | TC không DEPRECATED có ít nhất một test chạy lần này |
| Script | Test sinh từ TC (tên bắt đầu bằng mã TC). "Đã biết" = lỗi đã biết, xem dưới |
| Test khác | Test viết tay của dự án có mã feature trong tên (vd `smoke DM-F01-SCR01: …`) |

### Lỗi đã biết

Test kiểm đúng TC nhưng fail vì app làm khác TC/spec, mà chưa sửa ngay: **không sửa test cho khớp app**. Dự án ghi issue, đánh dấu test bằng `test.fail(true, "Lỗi app đã biết: <link issue>")` (cách đặt do hướng dẫn của dự án quy định, vd danh sách `KNOWN_BUGS` đầu script).

| Kết quả | `taf report` | Ghi bug |
|---|---|---|
| Test fail đúng như dự kiến | Mục **Lỗi đã biết** riêng, kèm link issue; không tính pass, không tính fail; job không đỏ | Không (đã có issue). TC còn lỗi đã biết thì `--close-fixed` không coi là đã pass |
| Test lại **pass** (app có thể đã sửa) | Tính là **fail**: "Test đánh dấu lỗi đã biết nhưng đã pass — gỡ dấu"; job đỏ để nhắc gỡ | Không |

`taf-result.json` (cùng thư mục với `run.report`): tổng, theo feature, danh sách lỗi (fingerprint, triage), lỗi đã biết (`known`), test flaky, từng test, bug đã ghi. Dùng để tổng hợp về sau.

## 5. Tracker adapter

`tracker.adapter: github` (có sẵn) dùng GitHub Issues của repo đang chạy (`GITHUB_REPOSITORY`, `GITHUB_TOKEN`). Adapter khác (Jira…) export `createTracker(cfg)` trả:

| Hàm | Việc |
|---|---|
| `list({ labels })` | Mọi issue có các nhãn, cả đóng: `{ id, title, state: 'open'\|'closed', reason?, body }` |
| `create({ title, body, labels })` | Tạo, trả `{ id, url }` |
| `comment(id, body)`, `reopen(id)`, `close(id)` | |

Marker `taf:fp` / `taf:tc` phải được giữ trong `body`.
