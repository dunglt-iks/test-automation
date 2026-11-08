# prompts/

Prompt cho Claude. Mỗi prompt chạy với cwd là repo dự án và đọc `taf.config.yml`.

| File | Đầu vào → đầu ra | Ràng buộc bắt buộc | Có |
|---|---|---|---|
| `testcase.md` | `taf spec --json` → TC markdown (status nháp) | Từ chối khi spec chưa duyệt; phủ mọi mã trong `required`; không tự đặt đã duyệt | ✓ |
| `script.md` | TC đã duyệt + `scripts.guide` → script (+ page object) | Chỉ ghi vào `allowedPaths`; qua `check-script`, `check-paths`, `lint-script`; không sửa script cho khớp app sai | ✓ |
| `triage.md` | Trace + TC + spec + diff PR → loại lỗi, bản sửa script | Không sửa code ứng dụng; không sửa script cho khớp ứng dụng sai | P2 |
