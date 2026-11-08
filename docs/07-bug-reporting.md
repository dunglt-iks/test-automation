# 07 — Triage, ghi bug, báo cáo

## 1. Triage

Playwright đã tự chạy lại test fail một lần (`retries: 1` trên CI). Test vẫn fail thì Claude đọc **trace + TC + spec + diff của PR** và phân loại:

| Loại | Dấu hiệu | Hành động |
|---|---|---|
| **Bug ứng dụng** | Giao diện hoặc dữ liệu khác kết quả mong đợi trong TC/spec | Tạo issue |
| **Lỗi script** | Không tìm thấy phần tử, locator trỏ sai, thiếu chờ, factory thiếu dữ liệu | Sửa page object/script, chạy lại, tối đa 2 vòng. Vẫn fail thì báo "cần người xem". |
| **Môi trường** | BE không lên, timeout mạng, migration lỗi | Không tạo bug, đánh dấu run lỗi môi trường, đính kèm log |
| **Flaky** | Lần đầu fail, lần chạy lại pass | Không tạo bug, ghi vào bảng flaky của report |
| **TC sai** | TC mâu thuẫn với spec hiện tại | Không tạo bug, comment yêu cầu sửa TC |

Nguyên tắc: **triage không bao giờ sửa code ứng dụng**, chỉ sửa file trong phạm vi được phép ([03 §5](03-script-generation.md)). **Không sửa script cho khớp với ứng dụng sai.** Script chỉ được sửa khi lỗi nằm ở cách tìm phần tử hay cách chờ. Kết quả mong đợi luôn theo TC.

## 2. GitHub Issue

Mỗi bug ứng dụng là một issue:

```markdown
Tiêu đề: [E2E] DL-F05 · TC-DL-F05-002: thành tiền sai khi SL = 2,5

Nhãn: bug, e2e, feature:DL-F05, P1

**Truy vết:** TC-DL-F05-002 · DL-F05-US02 · DL-BR18
**Môi trường:** ci · commit a1b2c3d · PR #42
**Persona:** sale

**Bước tái hiện**
1. …
**Mong đợi:** 250.000
**Thực tế:** 200.000

**Bằng chứng:** ảnh chụp lúc fail, link trace (artifact), đoạn log BE
**Phân tích của triage:** …

<!-- taf:fingerprint=TC-DL-F05-002:7c1e… -->
```

### Chống trùng và vòng đời

- **Fingerprint** = mã TC + hash thông điệp lỗi đã chuẩn hoá (bỏ id, giờ, số ngẫu nhiên).
- Đã có issue mở cùng fingerprint: thêm comment "gặp lại ở PR #… / commit …", không tạo mới.
- Issue đã đóng mà lỗi tái diễn: mở lại.
- TC pass trên `sale-tools` (run hồi quy): bot comment rồi **tự đóng** issue.
- Issue do người đóng tay (không phải bug, sẽ không sửa): fingerprint vào danh sách bỏ qua đến khi TC đổi.

## 3. Comment trên PR

Mỗi run cập nhật **một** comment (sửa comment cũ, không tạo thêm):

```markdown
## E2E-TAF · ✘ 1 bug · 23/25 pass

| Feature | TC | Kết quả | Ghi chú |
|---|---|---|---|
| DL-F05 | 12/13 | ✘ | #128 TC-DL-F05-002 thành tiền sai |
| DL-F05 | — | ⚠ flaky | TC-DL-F05-009 pass ở lần chạy lại |
| FS-F02 | 10/10 | ✓ | |

Gate: ✓ · Script sinh mới: 3 (commit e4f5a6b) · Report: [artifact](…)

<details><summary>Thiếu data-testid (2) — dev bổ sung qua /feature</summary>

| Màn hình | Thành phần | testid đề xuất | Đang dùng tạm |
|---|---|---|---|
| DL-F05-SCR01 | ④ nút Thêm | `dl-f05-scr01-add` | `getByRole('button', { name: … })` |
</details>
```

## 4. Report và artifact

| Đầu ra | Nội dung | Lưu |
|---|---|---|
| HTML report Playwright | Từng test, ảnh, trace | Artifact, chỉ khi có fail, 7 ngày |
| `taf-result.json` | Kết quả chuẩn hoá: TC, mã truy vết, loại triage, issue | Artifact, mọi run, 30 ngày (nhỏ) |
| Log BE/FE | `backend.log`, `vite.log` | Artifact khi fail |

`taf-result.json` là nguồn để sau này tổng hợp độ phủ theo feature hoặc nối vào `implementation-status.md` (trạng thái *Đã kiểm thử*).

## 5. Tracker khác

`tracker.type: jira` dùng adapter Jira (cần `JIRA_TOKEN`, project key). Định dạng nội dung và fingerprint giữ nguyên, chỉ đổi nơi ghi.
