---
feature: XX-F01
spec: docs/features/addon/XX-demo/FSD-demo/F01-don-hang.md
specHash: "HASH"
status: Đã duyệt
reviewer: someone
persona: sale
---

## TC-XX-F01-001 · Tạo đơn
- Truy vết: XX-F01-US01, XX-BR01
- Màn hình: XX-F01-SCR01

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm Thêm | Mở hộp |

## TC-XX-F01-002 · Sao chép
- Truy vết: XX-F01-US01-A1
- Persona: manager

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Sao chép | Có đơn mới |

## TC-XX-F01-003 · Huỷ [DEPRECATED]

## TC-XX-F01-004 · Huỷ tạo đơn
- Truy vết: XX-F01-US01-A2

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm Huỷ | Không có đơn mới |

## Ngoài phạm vi e2e
| Mã | Lý do | Kiểm ở đâu |
|---|---|---|
| XX-F01-US01-E1 | Chỉ qua API | Go test |
