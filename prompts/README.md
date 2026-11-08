# prompts/

Prompt cho Claude. Mỗi prompt chạy với cwd là repo dự án và đọc `taf.config.yml`.

| File | Đầu vào → đầu ra | Ràng buộc bắt buộc | Giai đoạn |
|---|---|---|---|
| `testcase.md` | Spec của một feature → TC markdown (`status: Nháp`) | Từ chối khi spec chưa duyệt; phủ mọi US/A/E; không tự đặt `Đã duyệt` | P0 |
| `script.md` | TC → script + page object + fixture | Chỉ ghi vào `allowedPaths`; dùng lại page object; theo luật lint ở [03 §2](../docs/03-script-generation.md) | P1 |
| `triage.md` | Trace + TC + spec + diff PR → loại lỗi, bản sửa script | Không sửa code ứng dụng; không sửa script cho khớp ứng dụng sai | P2 |
