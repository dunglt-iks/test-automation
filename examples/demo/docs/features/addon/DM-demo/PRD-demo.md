# PRD — Đơn hàng demo (DM)

Dự án mẫu của TAF: một app quản lý đơn hàng rất nhỏ, đủ để chạy hết luồng spec → test case → script → chạy → báo cáo → bug.

## Feature Summary

| Code | Tên | Mô tả ngắn | Spec |
|---|---|---|---|
| DM-F01 | Danh sách đơn hàng | Xem, tìm, xoá đơn; sale chỉ thấy đơn của mình | Đã duyệt |
| DM-F02 | Tạo đơn hàng | Form tạo đơn, tính thành tiền có chiết khấu | Đã duyệt |

## Vai trò × luồng

| Luồng | sale | manager |
|---|---|---|
| DM-F01-US01 Xem và tìm đơn | Đơn của mình | Mọi đơn |
| DM-F01-US02 Xoá đơn | — | ✓ |
| DM-F02-US01 Tạo đơn | ✓ | ✓ |
