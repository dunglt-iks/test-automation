# adapters/

Điểm cắm để framework chạy với dự án khác nhau. Chọn trong `taf.config.yml`: tên adapter có sẵn ở đây, hoặc đường dẫn `./…mjs` tới adapter dự án tự viết.

| Loại | Khai ở | Có sẵn | Hợp đồng |
|---|---|---|---|
| `spec/` | `spec.adapter` | `prd-fsd`: PRD + FSD của app-base | [01 §2](../docs/01-architecture.md) |
| `tracker/` | `tracker.adapter` | `github` | [07 §5](../docs/07-bug-reporting.md) |
