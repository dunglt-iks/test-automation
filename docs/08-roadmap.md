# 08 — Lộ trình, rủi ro, điểm còn mở

## 1. Lộ trình

| Giai đoạn | Nội dung | Thử trên | Xong khi |
|---|---|---|---|
| **P0** | Repo `test-automation`; định dạng TC; `/testcase`; `cli detect` + `cli gate`; workflow chỉ có detect + gate (chưa dùng AI trong CI) | `DL-F05` | PR thiếu TC bị gắn `e2e-blocked` |
| **P1** | Tách `deploy/ci/e2e-env-up.sh`; `env/*.yml` + persona + `globalSetup`; `components/` cho C07; page object; sinh script + commit vào PR; job run | `DL-F05`, `FS-F02` | TC đổi → script tự sinh, chạy xanh trên `ci` |
| **P2** | Triage; GitHub Issues + fingerprint; comment PR; `e2e-regression.yml` (push `sale-tools` + hằng đêm) | Toàn bộ feature đã có TC | Bug tự mở và tự đóng |
| **P3** | `testcase-draft.yml`; môi trường `dev`; tag `taf@v1`; tài liệu `taf init`; áp dụng cho dự án thứ hai | Aida | Dự án mới chạy được chỉ với `taf.config.yml` + adapter |

Thay đổi đi kèm trong app-base:

- `/feature` thêm quy ước `data-testid` theo bảng component của FSD ([03 §3](03-script-generation.md)).
- `playwright.config.ts` đọc `E2E_ENV`, thêm project riêng cho `generated/`.
- `.gitignore`: `web/e2e/.auth/`, `web/.env.e2e.local`.

## 2. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| OAuth token gói Claude dùng chung hạn mức với người dùng; CI có thể bị giới hạn giữa ngày làm việc | Cao | Chỉ gọi AI khi TC đổi hoặc test fail; `maxTurns`; hồi quy không dùng AI trừ triage. Hết hạn mức thì job báo rõ, không fail âm thầm. |
| Script AI đúng cú pháp nhưng kiểm sai ý | Cao | Script commit vào PR để review; tên test mang mã TC; lint cấm locator ngoài page object; `expect` phải ứng với cột "Kết quả mong đợi" |
| Chặn mềm bị bỏ qua | Trung bình | Nhãn + comment rõ; cân nhắc nâng Pro để bật required check |
| Runner VPS chạy một job mỗi lần, e2e ~45 phút | Trung bình | Job nhẹ chạy trên runner GitHub; chỉ chạy script của feature trong PR + smoke; thêm runner thứ hai khi cần |
| Locator CSS của Naive UI vỡ khi nâng phiên bản | Trung bình | Chỉ viết trong `components/`; ưu tiên `data-testid` |
| Môi trường `dev` dùng chung, dữ liệu bẩn | Thấp | Tenant `e2e-taf` riêng; dọn theo tiền tố; PR luôn chạy trên `ci` |
| TC lỗi thời khi spec đổi | Thấp | `specHash` + gate báo lỗi thời |

## 3. Điểm còn mở

Đã đặt mặc định, chỉnh nếu khác:

| # | Câu hỏi | Mặc định |
|---|---|---|
| O1 | 39 spec viết tay có chuyển sang POM / TC markdown không? | Giữ nguyên làm hồi quy, chỉ chuyển dần khi feature tương ứng có TC |
| O2 | "Đã review" xác định thế nào? | `status: Đã duyệt` + `reviewer` trong frontmatter, nằm trong commit đã merge. Không dựa vào approve của GitHub. |
| O3 | Repo `test-automation` public hay private? | Private + `TAF_TOKEN`. Public cũng được vì không chứa dữ liệu nghiệp vụ. |
| O4 | PR vào `main` (cherry-pick từ `sale-tools`) có chạy gate không? | Có, cùng workflow |
| O5 | Xoá tenant test trên `dev` — `CORE-C10` có hỗ trợ không? | Chưa kiểm. Tạm dọn theo tiền tố. |
| O6 | Có cần hiện kết quả e2e vào `implementation-status.md` không? | Chưa. Để `taf-result.json` sẵn cho sau này. |
