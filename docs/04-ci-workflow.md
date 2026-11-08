# 04 — GitHub Actions

## 1. Các workflow

| Workflow | Trigger | Việc làm |
|---|---|---|
| `e2e-spec.yml` | `pull_request` vào `sale-tools`, `main` | detect → gate → generate → run → triage → report |
| `e2e-regression.yml` | `push` vào `sale-tools`; hằng đêm (`schedule`); `workflow_dispatch` | Chạy toàn bộ script, ghi bug, không sinh script |
| `testcase-draft.yml` | `push` vào `sale-tools` làm cột Spec của feature đổi sang Đã duyệt | Feature chưa có TC thì Claude sinh TC nháp, mở PR `testcase/<FEATURE>` |

Job `e2e-test` hiện có trong `ci.yml` (chạy 39 spec viết tay) giữ nguyên, sau này gộp vào `e2e-regression.yml`.

## 2. `e2e-spec.yml` — các job

```
detect ──► gate ──► generate ──► run ──► triage ──► report
              │ fail                        │
              └─► comment + nhãn            └─► sửa script (≤2 vòng) → chạy lại
                  e2e-blocked, dừng
```

| Job | Đầu vào | Việc làm | AI |
|---|---|---|---|
| **detect** | Tiêu đề, nhánh, commit của PR; diff `implementation-status.md` | Lấy danh sách mã feature. PR đụng `trigger.codePaths` mà không có mã nào → **fail**, yêu cầu khai mã. PR chỉ đổi docs → bỏ qua cả workflow. | Không |
| **gate** | Danh sách feature | Mỗi feature: có file TC; `status: Đã duyệt`; phủ đủ US/A/E/SCR ([02 §3](02-testcase-format.md)); `specHash` khớp. Lỗi → comment liệt kê thiếu gì, gắn nhãn `e2e-blocked`. | Không |
| **generate** | TC có hash khác `@taf-source` | Claude sinh hoặc sửa script, page object, fixture. Kiểm tra phạm vi file ([03 §5](03-script-generation.md)): có file ngoài danh sách thì huỷ và fail. Chạy `tsc`, lint, `playwright --list`. Bot commit `test(e2e): sinh script <FEATURE> [taf]`. | Có |
| **run** | Commit sau generate | `env.up` dựng môi trường, `globalSetup` tạo persona, chạy script của các feature trong PR + test P1 (smoke). Reporter JSON + trace khi fail. | Không |
| **triage** | Test fail | Phân loại, sửa lỗi script ([07](07-bug-reporting.md)) | Có |
| **report** | Kết quả cuối | Comment PR, tạo/đóng issue, upload report | Không |

### Nhận diện mã feature (detect)

| Nguồn | Ví dụ |
|---|---|
| Tiêu đề PR | `feat(dl-f05): dòng sản phẩm trong deal` |
| Tên nhánh | `feat/core-c10-f06-c11-f04` → `CORE-C10-F06`, `CORE-C11-F04` |
| Commit message | `fix(DL-F05-US02): …` |
| `implementation-status.md` | Dòng `DL-F05` đổi sang *Hoàn thành* |

So khớp không phân biệt hoa thường, chuẩn hoá về chữ hoa.

## 3. Bẫy cần xử lý

| Bẫy | Cách xử lý |
|---|---|
| Commit đẩy bằng `GITHUB_TOKEN` **không kích hoạt** workflow mới, nên commit của bot không có check | Job `run` chạy luôn trên commit mới, rồi gắn commit status lên SHA mới qua API |
| Checkout repo `test-automation` private | Fine-grained PAT chỉ đọc `test-automation`, lưu ở secret `TAF_TOKEN`. Hoặc để repo public (không chứa dữ liệu nghiệp vụ). |
| Hai push liên tiếp vào cùng PR | `concurrency: e2e-<PR>` + `cancel-in-progress: true` |
| Bot commit tạo vòng lặp | detect bỏ qua commit có `[taf]` khi tính hash; generate không có gì để sinh thì không commit |
| Runner self-hosted chạy một job mỗi lần | Job nhẹ (detect, gate, report) chạy trên `ubuntu-latest`. Chỉ `run` dùng runner VPS. |

## 4. Chặn mềm (gói Free)

Repo private gói Free **không bật được branch protection / required check** (API trả 403). Vì vậy:

- Check `e2e-spec` đỏ và hiện rõ trên PR.
- Bot comment liệt kê lý do, gắn nhãn `e2e-blocked`. Gỡ nhãn tự động khi check xanh.
- Quy ước nhóm: **không merge PR có nhãn `e2e-blocked`**.
- Nâng GitHub Pro (khoảng 4 USD/tháng) thì bật required check `e2e-spec / gate` để chặn thật.

## 5. Giới hạn gói Free

| Hạng mục | Giới hạn | Cách xử lý |
|---|---|---|
| Phút Actions (runner GitHub) | 2000 phút/tháng cho repo private | Job nặng chạy trên runner VPS (không tính phút) |
| Artifact + cache | Khoảng 500MB | Chỉ upload report/trace khi fail, giữ 7 ngày |
| Environments, environment secrets | Không có trên repo private | Dùng repository secret có tiền tố (`E2E_CI_*`, `E2E_DEV_*`) |
| GitHub Pages cho report | Không có trên repo private | Report là artifact + comment PR |
| Issues | Không giới hạn | Dùng bình thường |

## 6. Secrets

| Secret | Dùng cho |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude trong CI (tạo bằng `claude setup-token`) |
| `TAF_TOKEN` | Checkout repo `test-automation` (nếu private) |
| `E2E_CI_ADMIN_PASSWORD` | Tài khoản bootstrap môi trường `ci` |
| `E2E_DEV_ADMIN_LOGIN`, `E2E_DEV_ADMIN_PASSWORD` | Tài khoản bootstrap môi trường `dev` |
| `GITHUB_TOKEN` (có sẵn) | Comment, nhãn, issue, commit status. Cần `permissions: contents: write, pull-requests: write, issues: write, statuses: write`. |

## 7. Khung workflow

```yaml
name: E2E spec
on:
  pull_request:
    branches: [sale-tools, main]
concurrency: { group: e2e-${{ github.event.pull_request.number }}, cancel-in-progress: true }
permissions: { contents: write, pull-requests: write, issues: write, statuses: write }

jobs:
  detect:
    runs-on: ubuntu-latest
    outputs: { features: ${{ steps.d.outputs.features }} }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/checkout@v4
        with: { repository: dunglt-iks/test-automation, ref: v1, path: .taf, token: ${{ secrets.TAF_TOKEN }} }
      - id: d
        uses: ./.taf/actions/detect
  gate:
    needs: detect
    if: needs.detect.outputs.features != '[]'
    runs-on: ubuntu-latest
    steps: [ … uses: ./.taf/actions/gate … ]
  generate-run-report:
    needs: [detect, gate]
    runs-on: ${{ fromJSON(vars.CI_RUNS_ON || '"ubuntu-latest"') }}
    steps:
      - … uses: ./.taf/actions/generate   # env CLAUDE_CODE_OAUTH_TOKEN
      - … uses: ./.taf/actions/run        # gọi deploy/ci/e2e-env-up.sh
      - … uses: ./.taf/actions/triage
      - if: always()
        … uses: ./.taf/actions/report
```

generate, run, triage, report gộp chung một job để dùng chung môi trường đã dựng và tránh xếp hàng trên runner VPS.
