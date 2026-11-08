---
feature: DM-F02
spec: docs/features/addon/DM-demo/FSD-demo.md
specHash: "4fce79a8528745d6"
status: Đã duyệt
reviewer: taf-demo
persona: sale
---

# Test case — DM-F02 Tạo đơn hàng

## TC-DM-F02-001 · Tạo đơn không chiết khấu
- Truy vết: DM-F02-US01
- Ưu tiên: P1
- Màn hình: DM-F02-SCR01, DM-F01-SCR01

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Ở *Đơn hàng* bấm ② *+ Tạo đơn* | Mở màn *Tạo đơn hàng* |
| 2 | Nhập khách hàng K, sản phẩm "Bút bi", SL 3, đơn giá 12.500 | ⑥ Thành tiền 37.500 |
| 3 | Bấm ⑦ *Lưu* | Về *Đơn hàng*, thông báo *Đã tạo đơn #<mã>* |
| 4 | Gõ K vào ① | Có dòng đơn của K, sản phẩm "Bút bi", thành tiền 37.500 |

## TC-DM-F02-002 · Tạo đơn có chiết khấu
- Truy vết: DM-F02-US01-A1, DM-BR01
- Ưu tiên: P1
- Màn hình: DM-F02-SCR01

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở *Tạo đơn hàng*, nhập khách hàng K, sản phẩm "Vở", SL 10, đơn giá 5.000, CK 10 | ⑥ Thành tiền 45.000 (10 × 5.000 × (1 − 10%)) |
| 2 | Bấm *Lưu*, gõ K vào ① | Dòng đơn của K: CK "10%", thành tiền 45.000 |

## TC-DM-F02-003 · Thành tiền tính theo DM-BR01 và làm tròn
- Truy vết: DM-F02-US01, DM-BR01
- Ưu tiên: P1
- Màn hình: DM-F02-SCR01
- Dữ liệu kiểm tra:

| Số lượng | Đơn giá | CK | Kết quả mong đợi |
|---|---|---|---|
| 1 | 100000 | 0 | 100.000 |
| 2.5 | 100000 | 10 | 225.000 |
| 3 | 33333 | 5 | 94.999 |
| 12 | 1000 | 50 | 6.000 |

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở *Tạo đơn hàng*, nhập số lượng, đơn giá, CK theo từng dòng dữ liệu | ⑥ Thành tiền đúng cột "Kết quả mong đợi" |

## TC-DM-F02-004 · Huỷ tạo đơn
- Truy vết: DM-F02-US01-A2
- Ưu tiên: P2
- Màn hình: DM-F02-SCR01

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở *Tạo đơn hàng*, nhập khách hàng K, bấm ⑧ *Huỷ* | Về *Đơn hàng* |
| 2 | Gõ K vào ① | *Không tìm thấy đơn phù hợp* |

## TC-DM-F02-005 · Số lượng không hợp lệ
- Truy vết: DM-F02-US01-E1
- Ưu tiên: P1
- Màn hình: DM-F02-SCR01
- Dữ liệu kiểm tra:

| Số lượng | Kết quả mong đợi |
|---|---|
| 0 | *Số lượng phải lớn hơn 0* |
| -1 | *Số lượng phải lớn hơn 0* |
| (trống) | *Số lượng phải lớn hơn 0* |

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập khách hàng, sản phẩm, đơn giá 1.000 hợp lệ, số lượng theo dòng dữ liệu, bấm *Lưu* | Lỗi hiện dưới ô ③, vẫn ở màn *Tạo đơn hàng* |

## TC-DM-F02-006 · Thiếu khách hàng
- Truy vết: DM-F02-US01-E2
- Ưu tiên: P2
- Màn hình: DM-F02-SCR01

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Để trống khách hàng, nhập sản phẩm, SL 1, đơn giá 1.000, bấm *Lưu* | Dưới ô ① hiện *Nhập tên khách hàng*, vẫn ở màn *Tạo đơn hàng* |

## TC-DM-F02-007 · Chiết khấu ngoài khoảng 0–100
- Truy vết: DM-F02-US01-E3
- Ưu tiên: P2
- Màn hình: DM-F02-SCR01
- Dữ liệu kiểm tra:

| CK | Kết quả mong đợi |
|---|---|
| -5 | *Chiết khấu từ 0 đến 100* |
| 101 | *Chiết khấu từ 0 đến 100* |

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập đủ các ô hợp lệ, CK theo dòng dữ liệu, bấm *Lưu* | Lỗi hiện dưới ô ⑤, vẫn ở màn *Tạo đơn hàng* |

## TC-DM-F02-008 · Giá trị mặc định của form
- Truy vết: DM-F02-SCR01
- Ưu tiên: P3
- Màn hình: DM-F02-SCR01

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở *Tạo đơn hàng* | SL 1, đơn giá 0, CK 0, ⑥ Thành tiền 0 |
