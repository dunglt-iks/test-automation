# lib/

Thư viện TypeScript mà test của dự án import. Không chứa gì riêng của dự án.

| Module | Việc làm | Tài liệu |
|---|---|---|
| `env` | Đọc `env/<E2E_ENV>.yml` + biến bí mật | [05 §2](../docs/05-environments.md) |
| `persona` | `globalSetup` tạo persona từ `personas.yml`, `persona('<tên>')` trả `storageState` | [05 §3](../docs/05-environments.md) |
| `cleanup` | Sổ đăng ký dọn dẹp, fixture `fx` tự dọn sau mỗi test | [06](../docs/06-test-data.md) |
| `data` | `uniq()`, chạy test theo bảng dữ liệu | [06](../docs/06-test-data.md) |

Phần riêng của dự án (cách gọi API tạo tenant, vai trò, tài khoản) được truyền vào qua hook do dự án viết. Giai đoạn P1.
