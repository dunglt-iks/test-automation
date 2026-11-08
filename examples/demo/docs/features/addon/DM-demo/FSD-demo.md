# FSD — Đơn hàng demo (DM)

## 1. DM-F01 — Danh sách đơn hàng

### Màn hình

#### DM-F01-SCR01 — Danh sách đơn

```
┌ Đơn hàng demo ─────────────────────────── <tên người dùng> [Đăng xuất] ┐
│ Đơn hàng                                                                │
│ [① Tìm khách hàng...........................]  [② + Tạo đơn]            │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ Mã │ Khách hàng │ Sản phẩm │ SL │ Đơn giá │ CK │ Thành tiền │ ③ Người tạo │ ④ Thao tác │
│ │ #2 │ An Phát    │ Bút bi   │ 10 │ 5.000   │ 10%│ 45.000     │ sale        │ [Xoá]      │
│ └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

| # | Thành phần | Mô tả | Luồng |
|---|---|---|---|
| ① | Ô *Tìm khách hàng* | Lọc theo tên khách hàng, không phân biệt hoa thường, chứa chuỗi | DM-F01-US01 |
| ② | Nút *+ Tạo đơn* | Mở màn tạo đơn DM-F02-SCR01 | DM-F02-US01 |
| ③ | Cột *Người tạo* | Tên đăng nhập người tạo đơn | DM-F01-US01 |
| ④ | Cột *Thao tác*, nút *Xoá* | Xoá đơn sau khi xác nhận | DM-F01-US02 |

**Quy tắc hiển thị**

- Đơn mới nhất ở trên cùng. Số tiền định dạng `vi-VN` (dấu chấm phân cách nghìn), chiết khấu kèm `%`.
- Chưa có đơn nào: thay bảng bằng dòng *Chưa có đơn hàng*.
- Tìm không ra: thay bảng bằng dòng *Không tìm thấy đơn phù hợp*.
- Cột ③ và ④ chỉ hiện với vai trò quản lý (manager).
- Sau khi tạo đơn thành công, quay về màn này và hiện thông báo *Đã tạo đơn #<mã>*.

### Luồng nghiệp vụ

#### DM-F01-US01 — Xem và tìm đơn

**Xem danh sách đơn hàng**

Kích hoạt từ: DM-F01-SCR01.

1. Người dùng mở *Đơn hàng*.
2. Hệ thống hiện các đơn người dùng được xem: sale thấy đơn do chính mình tạo.

- **A1 — Tìm theo khách hàng**: gõ vào ô ①, danh sách chỉ còn đơn có tên khách hàng chứa chuỗi đã gõ.
- **A2 — Quản lý thấy mọi đơn**: người dùng vai trò manager thấy đơn của mọi người, kèm cột ③.

#### DM-F01-US02 — Xoá đơn

**Xoá đơn hàng**

Kích hoạt từ: DM-F01-SCR01 ④.

1. Quản lý bấm *Xoá* trên một dòng.
2. Hệ thống hỏi *Xoá đơn #<mã>?* với hai nút *Huỷ*, *Xoá*.
3. Quản lý bấm *Xoá*: đơn biến mất khỏi danh sách, hiện thông báo *Đã xoá đơn #<mã>*.

- **A1 — Huỷ xoá**: bấm *Huỷ* ở bước 3, hộp xác nhận đóng, đơn vẫn còn.
- **E1 — Sale không xoá được**: người dùng vai trò sale không thấy cột ④ nên không có nút *Xoá*. Gửi yêu cầu xoá thẳng tới máy chủ bị từ chối "Chỉ quản lý được xoá đơn".

## 2. DM-F02 — Tạo đơn hàng

### Màn hình

#### DM-F02-SCR01 — Tạo đơn hàng

```
┌ Tạo đơn hàng ───────────────────┐
│ ① Khách hàng   [..............] │
│ ② Sản phẩm     [..............] │
│ ③ Số lượng     [1.............] │
│ ④ Đơn giá      [0.............] │
│ ⑤ Chiết khấu (%) [0...........] │
│ ⑥ Thành tiền: 0                 │
│ [⑦ Lưu] [⑧ Huỷ]                 │
└─────────────────────────────────┘
```

| # | Thành phần | Mô tả | Luồng |
|---|---|---|---|
| ①–⑤ | Ô nhập | Mặc định: SL 1, đơn giá 0, chiết khấu 0 | DM-F02-US01 |
| ⑥ | Thành tiền | Tự tính lại khi đổi ③④⑤ (DM-BR01) | DM-F02-US01 |
| ⑦ | *Lưu* | Kiểm dữ liệu, tạo đơn | DM-F02-US01 |
| ⑧ | *Huỷ* | Về danh sách, không tạo đơn | DM-F02-US01 |

**Quy tắc hiển thị**

- Lỗi kiểm dữ liệu hiện ngay dưới ô tương ứng, đơn không được tạo.

**DM-BR01 — Thành tiền**: Thành tiền = Số lượng × Đơn giá × (1 − Chiết khấu/100), làm tròn đến đồng. Áp dụng với mọi số lượng.

### Luồng nghiệp vụ

#### DM-F02-US01 — Tạo đơn

**Tạo đơn hàng mới**

Kích hoạt từ: DM-F01-SCR01 ②.

1. Người dùng nhập khách hàng, sản phẩm, số lượng, đơn giá.
2. Thành tiền ⑥ hiện theo DM-BR01.
3. Bấm *Lưu*: đơn được tạo, về danh sách, đơn mới nằm trên cùng với đúng thành tiền.

- **A1 — Có chiết khấu**: nhập chiết khấu ⑤, thành tiền trừ chiết khấu theo DM-BR01 (vd 10 × 5.000 × (1 − 10%) = 45.000).
- **A2 — Huỷ**: bấm *Huỷ*, về danh sách, không có đơn mới.
- **E1 — Số lượng không hợp lệ**: số lượng ≤ 0 hoặc để trống → *Số lượng phải lớn hơn 0*.
- **E2 — Thiếu khách hàng**: để trống khách hàng → *Nhập tên khách hàng*.
- **E3 — Chiết khấu ngoài khoảng**: chiết khấu < 0 hoặc > 100 → *Chiết khấu từ 0 đến 100*.
