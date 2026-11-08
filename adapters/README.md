# adapters/

Điểm cắm để framework chạy với dự án khác nhau.

| Adapter | Việc làm | Bản đầu tiên |
|---|---|---|
| `spec/` | Tìm spec theo mã feature, đọc trạng thái duyệt, liệt kê US/A/E/SCR, tính `specHash` | `prd-fsd`: định dạng PRD/FSD của `app-base` |
| `tracker/` | Tạo, tìm, mở lại, đóng bug | `github` (P2), `jira` (sau) |

Chọn adapter trong `taf.config.yml` (`spec.statusSource`, `tracker.type`).
