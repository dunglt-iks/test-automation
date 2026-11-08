# 02 — Test case markdown

## 1. Vị trí

Mỗi feature một file: `docs/testcases/<scope>/<FEATURE>.md`.

```
docs/testcases/
├── DL/DL-F05.md
├── FS/FS-F02.md
└── CORE-C10/CORE-C10-F06.md
```

## 2. Cấu trúc file

```markdown
---
feature: DL-F05
spec: docs/features/addon/DL-deal/FSD-deal/05-items.md
specHash: "3240100cb28002d8" # hash phần spec lúc sinh TC (`taf spec <mã> --hash`), luôn đặt trong ngoặc kép
status: Đã duyệt              # Nháp | Đã duyệt
reviewer: dunglt-iks
persona: sale                 # mặc định cho cả file, TC có thể ghi đè
---

## TC-DL-F05-001 · Thêm dòng sản phẩm từ bảng giá
- Truy vết: DL-F05-US01, DL-BR18
- Ưu tiên: P1
- Persona: sale
- Màn hình: DL-F05-SCR01
- Tiền điều kiện: deal ở giai đoạn "Tiếp cận"; bảng giá "Bán lẻ" có sản phẩm A giá 100.000

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở chi tiết deal, khối Dòng sản phẩm ③, bấm *Thêm* ④ | Mở bộ chọn PD-CMP01 |
| 2 | Chọn sản phẩm A, bấm *Chọn* | Dòng mới: SL 1, đơn giá 100.000, thành tiền 100.000 |

## TC-DL-F05-002 · Số lượng không hợp lệ
- Truy vết: DL-F05-US02-E1
- Dữ liệu kiểm tra:

| Số lượng | Thành tiền mong đợi |
|---|---|
| 0 | báo lỗi "Số lượng phải > 0" |
| -1 | báo lỗi "Số lượng phải > 0" |
| 2,5 | 250.000 |
```

### Trường bắt buộc

| Trường | Quy tắc |
|---|---|
| Mã TC | `TC-<FEATURE>-###`, tăng dần, không dùng lại. TC bỏ đi giữ mã và gắn `[DEPRECATED]`. |
| Truy vết | Ít nhất một mã spec cụ thể nhất: `US`, nhánh `A#`/`E#`, có thể kèm `BR##` |
| Bước / Kết quả | Mỗi bước có kết quả quan sát được trên giao diện. Không mô tả nội bộ (DB, API). |
| Màn hình, số ③④ | Lấy theo wireframe và bảng component của FSD. Đây là đầu mối để ánh xạ ra `data-testid` (xem [03](03-script-generation.md)). |

### Trường tuỳ chọn

- **Persona:** ghi đè persona của file. Bắt buộc với TC kiểm quyền hoặc phạm vi dữ liệu.
- **Tiền điều kiện:** mô tả *trạng thái cần có* bằng lời. Không viết code. Script tạo trạng thái này qua fixture (xem [06](06-test-data.md)).
- **Dữ liệu kiểm tra:** bảng dữ liệu. Mỗi dòng sinh thành một test.
- **Ưu tiên:** P1 chạy trong smoke, P2/P3 chạy trong hồi quy đầy đủ.

## 3. Quy tắc phủ

Gate tự đọc FSD để kiểm tra (theo mục "Requirement traceability" của `docs/guide-en/testing.md`):

- Mỗi **luồng chính** `US##` có ít nhất 1 TC.
- Mỗi **nhánh** `A#` và `E#` có ít nhất 1 TC.
- Mỗi màn hình `SCR##` của feature xuất hiện trong ít nhất 1 TC.
- Nhánh không kiểm được bằng e2e (thuần backend, hẹn giờ dài…) ghi vào mục cuối file kèm lý do và nơi đã kiểm:

```markdown
## Ngoài phạm vi e2e
| Mã | Lý do | Kiểm ở đâu |
|---|---|---|
| DL-F05-US03-E2 | Lỗi đồng thời hai người sửa, khó tái hiện ổn định trên UI | Go test `items_test.go` |
```

## 4. Phát hiện TC lỗi thời

`specHash` là hash phần spec của feature (các mục screen, flow, BR liên quan) lúc sinh TC. Khi spec đổi, hash hiện tại khác `specHash` và gate báo **TC lỗi thời**. Người review cập nhật TC (hoặc chạy lại `/testcase` ở chế độ đồng bộ), duyệt lại, rồi ghi hash mới.

## 5. Quy trình sinh và duyệt

```
Spec Đã duyệt
  ├─ local: /testcase DL-F05 ─────────────┐
  └─ CI: testcase-draft.yml mở PR nháp ───┤
                                          ▼
                         TC status: Nháp (Claude sinh)
                                          │ người review sửa, bổ sung case biên
                                          ▼
                         TC status: Đã duyệt, reviewer: <login>
                                          │ push lên nhánh code / merge PR testcase
                                          ▼
                         gate chấp nhận
```

- `/testcase` **từ chối chạy** khi spec của feature còn Nháp.
- Chỉ người review được đổi `status` sang Đã duyệt. Claude không tự đặt Đã duyệt.
- Chạy lại `/testcase` trên file đã có là **chế độ đồng bộ**: chỉ thêm TC cho nhánh mới, đánh dấu TC có nhánh đã bỏ là `[DEPRECATED]`, đưa `status` về Nháp.
