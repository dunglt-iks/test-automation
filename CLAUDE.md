# CLAUDE.md — repo test-automation (TAF)

Repo này là **framework kiểm thử dùng chung**. Đọc [README.md](README.md) và [docs/README.md](docs/README.md) trước khi làm.

## Quy tắc

1. **Không đưa thứ riêng của một dự án vào repo này** (mã spec, đường dẫn, tên màn hình, tài khoản). Ví dụ trong tài liệu được phép lấy từ `app-base`, nhưng phải ghi rõ là ví dụ.
2. Phần riêng của dự án đi qua `taf.config.yml` hoặc adapter trong `adapters/`.
3. Prompt trong `prompts/` phải giữ hai ràng buộc: Claude **không sửa code ứng dụng** (chỉ ghi vào `scripts.allowedPaths`), và **test theo spec/TC, không theo hành vi hiện tại của code**.
4. Bước quyết định (gate, chọn test, fingerprint, ghi bug) viết bằng code tất định trong `cli/`, không giao cho AI.
5. Tài liệu viết bằng tiếng Việt, súc tích. Mỗi file trong `docs/` dưới ~50KB.
6. Đổi thiết kế thì cập nhật tài liệu trong `docs/` cùng commit: tăng phiên bản phụ, thêm dòng Change Log ở `docs/README.md`.
7. Phát hành theo tag semver (`v1.0.0`) và tag nổi `v1`. Đổi định dạng TC hay `taf.config.yml` không tương thích ngược thì tăng phiên bản chính.
