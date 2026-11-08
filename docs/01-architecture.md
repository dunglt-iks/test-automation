# 01 — Kiến trúc

## 1. Hai repo, phụ thuộc một chiều

```
┌─ app repo (vd app-base) ───────────────────────┐      ┌─ test-automation (TAF) ──────────────┐
│ docs/features/…        spec (US / A# / E#)     │      │ prompts/   testcase, script, triage  │
│ docs/testcases/…       TC markdown             │      │ cli/       detect, gate, lint-tc,    │
│ web/e2e/components/    component object (C07)  │ uses │            report, file-bugs         │
│ web/e2e/pages/         page object (mỗi SCR)   │◄─────│ actions/   composite action từng job │
│ web/e2e/fixtures/      factory dữ liệu (API)   │      │ lib/       env, persona, cleanup,    │
│ web/e2e/generated/     script do bot sinh      │      │            data-driven helper        │
│ web/e2e/env/*.yml      cấu hình môi trường     │      │ claude/    lệnh /testcase            │
│ web/e2e/personas.yml   persona                 │      │ adapters/  spec, tracker             │
│ deploy/ci/e2e-env-up.sh  dựng BE + FE + DB     │      │ templates/ file mẫu cho dự án mới    │
│                                                │      │ docs/      tài liệu này              │
│                                                │      └──────────────────────────────────────┘
│ taf.config.yml         adapter của dự án       │
│ .github/workflows/e2e-spec.yml                 │
└────────────────────────────────────────────────┘
```

- Dự án **dùng** `taf`. `taf` không biết gì về dự án.
- Mọi thứ phụ thuộc vào code của dự án (page object, fixture, persona, cách dựng môi trường) đều nằm trong repo dự án.
- Phát hành `taf` theo tag (`v1`, `v1.2.0`). Dự án ghim phiên bản trong workflow.

## 2. Claude chạy trong repo ứng dụng

Trên CI, workflow chạy trong repo ứng dụng và checkout `taf` vào thư mục con `.taf/`:

```
$GITHUB_WORKSPACE/          ← app repo tại commit PR head; cwd của Claude
└── .taf/                   ← taf @ tag đã ghim
```

Lý do:

| Nếu Claude chạy ở repo khác | Khi chạy trong repo ứng dụng |
|---|---|
| Đọc file ngoài thư mục làm việc phải cấp quyền (`--add-dir`), CI không có người bấm duyệt | Đọc tự do |
| Không nạp `CLAUDE.md` và quy ước của dự án | Tự nạp quy ước: mã US/A/E, cấu trúc FSD, `docs/guide-en/testing.md` |
| Code đọc được có thể lệch với bản đang test | Code, spec và TC cùng một commit |

Local cũng vậy: `/testcase` chạy trong app repo. Lệnh được cài từ `taf/claude/` vào `.claude/commands/` bằng `taf init`.

## 3. `taf.config.yml` — adapter của dự án

Đây là phần duy nhất mỗi dự án phải viết. Mọi thứ khác lấy từ `taf`.

```yaml
version: 1
spec:
  roots: [docs/features]
  featurePattern: '(?:[A-Z]{2,4}|CORE-C\d{2})-F\d{2}'
  branchPattern: '(?:[A-Z]{2,4}|CORE-C\d{2})-F\d{2}-US\d{2}(?:-[AE]\d)?'
  statusSource: prd-feature-table      # cột "Spec" trong bảng Feature Summary của PRD
  approvedValue: Đã duyệt
testcases:
  dir: docs/testcases
scripts:
  dir: web/e2e/generated
  pages: web/e2e/pages
  components: web/e2e/components
  fixtures: web/e2e/fixtures
  workdir: web                         # nơi chạy pnpm exec playwright
  allowedPaths:                        # Claude chỉ được ghi vào đây (03 §5)
    - docs/testcases/**
    - web/e2e/generated/**
    - web/e2e/pages/**
    - web/e2e/components/**
    - web/e2e/fixtures/**
    - web/e2e/assets/**
    - web/e2e/personas.yml
env:
  up: deploy/ci/e2e-env-up.sh
  default: ci
trigger:
  codePaths: [server/**, web/src/**]
  statusFile: docs/features/implementation-status.md
tracker:
  type: github                         # github | jira
  labels: [bug, e2e]
ai:
  auth: oauth                          # oauth | api-key
  maxTurns: { generate: 40, triage: 15 }
```

## 4. Thành phần trong `taf`

| Thành phần | Vai trò | Dùng AI |
|---|---|---|
| `cli detect` | Lấy danh sách mã feature của PR | Không |
| `cli gate` | Kiểm tra TC: có, đã duyệt, phủ đủ, không lỗi thời | Không |
| `cli lint-tc` | Kiểm tra cú pháp TC markdown | Không |
| `prompts/testcase.md` | Spec → TC | Có |
| `prompts/script.md` | TC → script | Có |
| `prompts/triage.md` | Phân loại lỗi, sửa script | Có |
| `cli report` | Đọc kết quả JSON của Playwright → comment PR | Không |
| `cli file-bugs` | Tạo, mở lại, đóng issue | Không |
| `lib/*` | Đọc env, persona + `storageState`, sổ dọn dẹp, sinh tên duy nhất | Không |

Mọi bước quyết định (gate, chọn test, ghi bug) là code tất định. AI chỉ dùng ở ba chỗ cần đọc hiểu: viết TC, viết script, đọc lỗi.

## 5. Điều kiện để áp dụng cho dự án khác

1. Spec có mã truy vết ổn định cho từng luồng và nhánh. Không cần đúng định dạng FSD của app-base, chỉ cần khai `featurePattern` và một spec adapter.
2. Có script dựng môi trường chạy được không cần tương tác (`env.up`).
3. Có một tài khoản bootstrap tạo được persona qua API.
4. Ứng dụng web chạy trên trình duyệt (Playwright).
