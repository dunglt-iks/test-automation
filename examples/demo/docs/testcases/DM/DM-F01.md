---
feature: DM-F01
spec: docs/features/addon/DM-demo/FSD-demo.md
specHash: "8aae44b8a6c7d13b"
status: Đã duyệt
reviewer: taf-demo
persona: sale
---

# Test case — DM-F01 Danh sách đơn hàng

## TC-DM-F01-001 · Sale thấy đơn của mình, không thấy đơn của sale khác
- Truy vết: DM-F01-US01
- Ưu tiên: P1
- Màn hình: DM-F01-SCR01
- Tiền điều kiện: sale có 1 đơn khách K1 (SL 2, đơn giá 50.000, CK 0); sale-2 có 1 đơn khách K2

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở *Đơn hàng*, gõ tên K1 vào ① *Tìm khách hàng* | Có dòng đơn của K1, thành tiền 100.000 |
| 2 | Gõ tên K2 vào ① | Hiện *Không tìm thấy đơn phù hợp* |

## TC-DM-F01-002 · Tìm theo khách hàng không phân biệt hoa thường
- Truy vết: DM-F01-US01-A1
- Ưu tiên: P2
- Màn hình: DM-F01-SCR01
- Tiền điều kiện: sale có 2 đơn, khách "<X> Alpha" và "<X> Beta" (X là chuỗi duy nhất)

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Gõ "<x> alpha" (chữ thường) vào ① | Chỉ còn dòng của "<X> Alpha" |

## TC-DM-F01-003 · Tìm không ra
- Truy vết: DM-F01-US01-A1, DM-F01-SCR01
- Ưu tiên: P3
- Màn hình: DM-F01-SCR01

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Gõ một chuỗi không khớp khách hàng nào vào ① | Bảng ẩn, hiện *Không tìm thấy đơn phù hợp* |

## TC-DM-F01-004 · Quản lý thấy đơn của sale, có cột Người tạo và Thao tác
- Truy vết: DM-F01-US01-A2
- Ưu tiên: P1
- Persona: manager
- Màn hình: DM-F01-SCR01
- Tiền điều kiện: sale có 1 đơn khách K

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở *Đơn hàng* | Có cột ③ *Người tạo* và ④ *Thao tác* |
| 2 | Gõ tên K vào ① | Có dòng đơn của K, người tạo "sale", có nút *Xoá* |

## TC-DM-F01-005 · Sale không thấy cột Người tạo, Thao tác và nút Xoá
- Truy vết: DM-F01-US02-E1
- Ưu tiên: P1
- Màn hình: DM-F01-SCR01
- Tiền điều kiện: sale có 1 đơn khách K

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Mở *Đơn hàng*, gõ tên K vào ① | Có dòng đơn của K, không có cột ③ ④, dòng không có nút *Xoá* |

## TC-DM-F01-006 · Quản lý xoá đơn
- Truy vết: DM-F01-US02
- Ưu tiên: P1
- Persona: manager
- Màn hình: DM-F01-SCR01
- Tiền điều kiện: sale có 1 đơn khách K, mã đơn M

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Gõ tên K vào ①, bấm *Xoá* trên dòng | Hộp xác nhận *Xoá đơn #M?* |
| 2 | Bấm *Xoá* | Hộp đóng, thông báo *Đã xoá đơn #M*, hiện *Không tìm thấy đơn phù hợp* |

## TC-DM-F01-007 · Huỷ xoá đơn
- Truy vết: DM-F01-US02-A1
- Ưu tiên: P2
- Persona: manager
- Màn hình: DM-F01-SCR01
- Tiền điều kiện: sale có 1 đơn khách K

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Gõ tên K vào ①, bấm *Xoá*, rồi bấm *Huỷ* | Hộp xác nhận đóng, dòng đơn của K vẫn còn |

## TC-DM-F01-008 · Đơn mới nhất ở trên, số tiền định dạng vi-VN
- Truy vết: DM-F01-SCR01
- Ưu tiên: P3
- Màn hình: DM-F01-SCR01
- Tiền điều kiện: sale tạo lần lượt 2 đơn cùng tiền tố khách hàng X: đơn 1 (SL 1, đơn giá 1.000, CK 0), đơn 2 (SL 1, đơn giá 1.234.567, CK 10)

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Gõ X vào ① | Dòng đầu là đơn 2: CK "10%", thành tiền 1.111.110; dòng sau là đơn 1, thành tiền 1.000 |
