# 04 — CI/CD và GitHub Actions

## 1. TAF nằm ở đâu

TAF **không deploy**. Có hai cách có app để test, đều do dự án quyết:

| | Dựng tạm trong CI | Môi trường đã deploy (sau CD) |
|---|---|---|
| App ở đâu | Trên runner của job, đúng commit của PR, hết job là bỏ | Server Dev/Staging do CD của dự án deploy |
| Target | `run.targets.ci` có `start` / `stop` | `run.targets.dev` chỉ có `test` |
| Khi nào | Mỗi PR | Sau mỗi lần CD deploy xong; hằng đêm |

```
PR ──────────────────────────────── CI ────────────────────────────────────
  (lint, unit test, build của dự án)
  TAF detect → gate → generate                        không cần app
  TAF run target=ci: [start app tạm] → test → [stop]  → report (+ triage, bug)
                         │ merge
Push nhánh phát triển ───────────── CD (của dự án, TAF không tham gia) ────
  build → deploy Dev ──(workflow_run: deploy xong)──► TAF run target=dev → report, bug
Hằng đêm ──────────────────────────────────────────────────────────────────
  TAF run target=dev --all → report, bug
```

Dự án đã có job e2e tự dựng app (vd app-base) có thể gọi bước `run` của TAF ngay trong job đó, với target không có `start`, để không dựng app hai lần.

## 2. Workflow mẫu

Trong [`templates/workflows/`](../templates/workflows/):

| File | Trigger | Job |
|---|---|---|
| `e2e-spec.yml` | `pull_request` | detect → gate → generate → run (target `ci`) → report |
| `e2e-regression.yml` | `workflow_run` (CD xong), `schedule`, `workflow_dispatch` | run (target `dev`, `--all`) → report |
| `testcase-draft.yml` | `push` vào nhánh phát triển có đổi spec | `taf newly-approved` → Claude sinh TC nháp → mở PR |

## 3. Các bước của `e2e-spec.yml`

```
detect ──► gate ──► generate ──► run ──► report
              │ ✘                          ├─ triage (AI, khi có test fail)
              └─ comment + nhãn            └─ file-bugs (bug app → issue theo fingerprint)
                 e2e-blocked, dừng
```

| Bước | Action | Việc | AI |
|---|---|---|---|
| detect | `actions/detect` | Lấy mã feature từ tiêu đề PR, nhánh, tiêu đề commit, status file (nếu khai). Sửa `trigger.codePaths` mà không có mã nào → fail, trừ khi có nhãn `trigger.skipLabel` | Không |
| gate | `actions/gate` | Mỗi feature: có TC, đã duyệt, phủ đủ `requiredCodes`, `specHash` khớp. Lỗi → comment + nhãn `gate.blockedLabel` | Không |
| generate | `actions/generate` | `taf plan-gen` chọn feature có TC đã duyệt mà script chưa có hoặc lệch hash → Claude viết script theo `prompts/script.md` → `taf check-paths`, `taf check-script`, `scripts.lint` → commit vào nhánh PR. Thiếu secret AI thì bỏ qua và cảnh báo | Có |
| run | `actions/run` | `taf run --target <t>`: start → test (`{files}` = script của feature trong PR) → stop. Upload report | Không |
| report | `actions/report` | Có test fail và có secret AI: triage. `taf report` (bảng theo feature, comment PR), `taf file-bugs` | Một phần |

### Nhận diện mã feature (detect)

| Nguồn | Ví dụ |
|---|---|
| Tiêu đề PR | `feat(dl-f05): dòng sản phẩm` |
| Tên nhánh | `feat/core-c10-f06-c11-f04` → `CORE-C10-F06`, `CORE-C11-F04` (qua `spec.normalize`) |
| Tiêu đề commit (không đọc phần thân) | `fix(DL-F05-US02): …` |
| `trigger.statusFile` (tuỳ chọn) | Dòng bảng có mã feature đổi sang một giá trị trong `trigger.statusDone` |

Mẫu mã do spec adapter quyết (`featureRegex`). Mã không có trong spec chỉ cảnh báo.

## 4. Bẫy

| Bẫy | Cách xử lý |
|---|---|
| Commit đẩy bằng `GITHUB_TOKEN` không kích hoạt workflow mới | generate, run, report nằm cùng một job, chạy luôn trên commit mới |
| Bot commit tạo vòng lặp | Commit của bot có `[taf]`; `plan-gen` thấy hash khớp thì không sinh, không commit |
| Hai push liên tiếp vào cùng PR | `concurrency: e2e-<PR>`, `cancel-in-progress: true` |
| Runner self-hosted chạy một job mỗi lần | detect, gate chạy trên runner GitHub; job nặng chạy trên runner riêng |
| Repo TAF private | PAT chỉ đọc, secret `TAF_TOKEN`; hoặc để TAF public |

## 5. Chặn mềm (repo private gói Free)

Gói Free không bật được required check cho repo private. Gate đỏ + comment + nhãn `e2e-blocked`; quy ước nhóm không merge PR còn nhãn. Repo public hoặc gói Pro/Team thì đặt check `gate` là bắt buộc.

## 6. Secrets

| Secret | Dùng cho |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` (hoặc `ANTHROPIC_API_KEY`) | generate, triage, testcase-draft. Không có thì các bước AI tự bỏ qua |
| `GITHUB_TOKEN` (có sẵn) | Comment, nhãn, issue, commit bot. `permissions: contents: write, pull-requests: write, issues: write` |
| Secret của dự án | Lệnh `start` / `test` của dự án tự đọc (TAF không biết) |
