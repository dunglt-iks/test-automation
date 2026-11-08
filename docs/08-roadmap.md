# 08 — Lộ trình, rủi ro, điểm còn mở

## 1. Lộ trình

Hoàn thiện TAF trên dự án mẫu [`examples/demo`](../examples/demo/), phát hành v1.0.0, rồi mới áp dụng vào app-base.

| # | Việc | Xong khi | Trạng thái |
|---|---|---|---|
| 0 | P0: `/testcase`, `taf spec`, `lint-tc`, `gate`, `detect`, action detect + gate | PR thiếu TC bị gắn `e2e-blocked` (đã chạy thật trên app-base PR #39) | ✓ v0.1.0 |
| 1 | Lõi tổng quát: spec adapter theo cấu hình, bộ nhãn TC, `run.targets` + `taf run`; bỏ `lib/` | Lõi không còn gắn với app-base | ✓ |
| 2 | Dự án mẫu `examples/demo`: app nhỏ, spec, TC, phần của dự án (Playwright, persona, page object, hướng dẫn viết test) | Chạy được `taf run` trên demo | ✓ |
| 3 | Sinh script: `prompts/script.md`, `taf plan-gen`, `check-paths`, `check-script`, `rehash`, action `generate` | TC đổi → script tự sinh, qua kiểm tra | ✓ (phần AI kiểm local: 22 test sinh từ 16 TC demo, xanh) |
| 4 | Chạy: action `run` | Demo chạy xanh trên CI của repo này | ✓ |
| 5 | Báo cáo và bug: `taf report`, `prompts/triage.md`, `taf file-bugs` + tracker adapter `github`, action `report` | Bug cài sẵn trong demo thành issue, tự đóng khi hết lỗi | ✓ (thử thật: issue #1, #2) |
| 6 | Workflow mẫu đầy đủ (PR, sau CD, hằng đêm), `taf newly-approved` + action `testcase-draft`, `taf init` | Dự án mới chạy được chỉ với file mẫu | ✓ |
| 7 | Tag `v1.0.0` | CI xanh; luồng PR thật đã chạy (PR thử #5) | ✓ |

**Sau v1.0.0, áp dụng vào app-base** (trong repo app-base):

- Viết phần của dự án: `globalSetup` (tenant, vai trò, tài khoản theo persona), page object, `TAF-GUIDE.md`, khai `run.targets`.
- Gắn `taf run` vào job `e2e-test` sẵn có của `ci.yml` (target không có `start`), không dựng app lần hai.
- Gộp e2e cũ theo 3 bước: (A) TAF chạy và báo cáo luôn cho 34 spec viết tay (tên test đã có mã spec); (B) `/feature` và agent `tester` thôi viết spec e2e mới, e2e chỉ đi qua TC → duyệt → script sinh; (C) chuyển dần từng feature, bỏ test cũ khi script sinh đã xanh.

## 2. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| OAuth token gói Claude dùng chung hạn mức với người dùng | Cao | Chỉ gọi AI khi TC đổi hoặc test fail; giới hạn số lượt. Thiếu secret hoặc hết hạn mức thì bước AI bỏ qua và báo rõ |
| Script AI đúng cú pháp nhưng kiểm sai ý | Cao | Người duyệt TC (ý định); tên test là mã TC; `check-script` kiểm mỗi TC có test; `forbid` cấm locator ngoài page object; script commit vào PR |
| Chặn mềm bị bỏ qua | Trung bình | Nhãn + comment rõ; repo public hoặc gói trả phí thì bật required check |
| Dự án mẫu đơn giản hơn app thật | Trung bình | Lần áp dụng đầu vào app-base có thể cần bản vá `v1.x` |
| TC lỗi thời khi spec đổi | Thấp | `specHash` + gate báo lỗi thời |

## 3. Điểm còn mở

| # | Câu hỏi | Mặc định |
|---|---|---|
| O2 | "Đã review" xác định thế nào? | `status` đã duyệt + `reviewer` trong frontmatter, nằm trong commit đã merge. Không dựa vào approve của GitHub. |
| O3 | Repo TAF public hay private? | Public (đã chuyển 2026-11-08), không cần token checkout. |
| O6 | Có ghi kết quả e2e vào status file của dự án không? | Chưa. `taf-result.json` để sẵn. |
