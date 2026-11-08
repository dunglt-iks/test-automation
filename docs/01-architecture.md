# 01 — Kiến trúc

## 1. Ranh giới: TAF chỉ giữ cơ chế

TAF không biết gì về nghiệp vụ hay hạ tầng của ứng dụng. Nó làm ba việc:

1. **Spec → test case → chặn PR**: đọc spec qua adapter, sinh TC, kiểm định dạng, độ phủ, TC lỗi thời; comment và gắn nhãn PR.
2. **Test case → script**: Claude viết script theo hướng dẫn của dự án, chỉ ghi vào thư mục được phép, commit vào PR.
3. **Điều phối chạy và báo cáo**: gọi lệnh của dự án theo thứ tự cố định, đọc kết quả Playwright, phân loại lỗi, mở/đóng bug, comment PR.

Phần còn lại là của **dự án**: dựng và cấu hình môi trường, tài khoản và vai trò, persona, dữ liệu test, page object, cấu hình Playwright. TAF **không deploy**: deploy thuộc CD của dự án. TAF chỉ chạy test vào một target (app dựng tạm trong job CI, hoặc môi trường đã deploy).

## 2. Điểm cắm

Mọi thứ riêng của dự án đi qua `taf.config.yml`:

| Điểm cắm | Khai ở | TAF lo | Dự án lo |
|---|---|---|---|
| Spec adapter | `spec.adapter`: `prd-fsd` (có sẵn) hoặc `./đường/dẫn.mjs` | Gate, lint, detect, prompt dùng kết quả của adapter | Đọc spec, luật đánh mã, mã nào bắt buộc phủ |
| Định dạng TC | `testcases.labels`: `vi` \| `en` \| ghi đè | Đọc, kiểm cú pháp | Chọn ngôn ngữ nhãn |
| Persona | `testcases.personas` (tuỳ chọn) | Chỉ kiểm tên persona trong TC có trong danh sách | Ý nghĩa, cách tạo, cách đăng nhập |
| Viết script | `scripts.guide`, `scripts.allowedPaths`, `scripts.forbid`, `scripts.lint` | Prompt, kiểm đường dẫn, kiểm script khớp TC, gọi lệnh lint | Hướng dẫn viết test, page object, fixture |
| Chạy test | `run.targets.<tên>`: `start?`, `test`, `stop?`, `cwd?`, `logs?` | Thứ tự start → test → stop (stop luôn chạy), chọn file, gom JSON report, in log khi lỗi | Nội dung các lệnh |
| Bug tracker | `tracker.adapter`: `github` (có sẵn) hoặc `./x.mjs` | Fingerprint, mở / mở lại / đóng | — |

### Hợp đồng spec adapter

Module export `createSpecAdapter(cfg)` trả object có:

| Hàm | Trả |
|---|---|
| `findFeature(code)` | `null` hoặc `{ code, name, file, line, deprecated, approved, status, statusFile, hash, ... }`. `hash` đổi khi nội dung spec của feature đổi |
| `listFeatures()` | Danh sách mã feature |
| `requiredCodes(feature)` | Các mã TC phải phủ (luồng, nhánh, màn hình… tuỳ dự án) |
| `scopeOf(code)` | Thư mục con chứa TC (vd `DL-F05` → `DL`) |
| `featureRegex()` | RegExp `g`, nhóm 1 là mã feature. Dùng tìm mã trong tiêu đề PR, nhánh, commit |
| `traceRegex()` | RegExp `g`, nhóm 1 là mã truy vết. Dùng đọc dòng truy vết của TC và tên test |

Adapter `prd-fsd` có sẵn đọc định dạng PRD + FSD của app-base (feature `## N. MÃ — tên`, luồng `#### MÃ-USnn`, nhánh `- **A1 — …`, màn hình `#### MÃ-SCRnn`, trạng thái ở cột "Spec" của PRD).

## 3. Hai repo, Claude chạy trong repo dự án

```
repo dự án (CWD)                         .taf/  (TAF @ tag đã ghim)
├── taf.config.yml                       ├── cli/        taf spec | lint-tc | gate | detect | run | report | file-bugs …
├── <spec>                               ├── actions/    composite action từng job
├── docs/testcases/<scope>/<MÃ>.md       ├── prompts/    testcase, script, triage
├── <scripts.dir>/<MÃ>.spec.ts  ← sinh   ├── adapters/   spec (prd-fsd), tracker (github)
├── page object, fixture, persona…       ├── claude/     lệnh /testcase cho Claude Code
├── lệnh dựng app, playwright.config     ├── templates/  file mẫu, workflow mẫu
└── .github/workflows/e2e-*.yml          └── examples/demo/  dự án mẫu chạy đủ luồng
```

- Dự án **dùng** TAF, TAF không biết gì về dự án. Phát hành theo tag, dự án ghim phiên bản.
- Claude luôn chạy trong repo dự án: đọc được code, spec, TC cùng commit; tự nạp `CLAUDE.md` của dự án; không cần cấp quyền đọc thư mục ngoài.

## 4. `taf.config.yml`

```yaml
version: 1
spec:
  adapter: prd-fsd
  roots: [docs/features]
  featurePattern: '(?:[A-Z]{2,4}|CORE-C\d{2})-F\d{2}'   # tuỳ chọn của prd-fsd
  approvedValue: Đã duyệt
testcases:
  dir: docs/testcases
  labels: vi
  personas: e2e/personas.yml           # tuỳ chọn
scripts:
  dir: e2e/generated                   # <dir>/<MÃ><ext>
  ext: .spec.ts
  guide: e2e/TAF-GUIDE.md              # Claude đọc trước khi viết script
  allowedPaths: [docs/testcases/**, e2e/generated/**, e2e/pages/**]
  forbid: ['page\.locator\(']          # cấm trong script sinh ra (locator chỉ nằm trong page object)
  lint: npx tsc --noEmit               # tuỳ chọn
run:
  report: taf-results/results.json     # TAF đặt PLAYWRIGHT_JSON_OUTPUT_NAME tới đây
  targets:
    ci:                                # PR: app dựng tạm trong job
      start: ./ci/app-up.sh            # tuỳ chọn; thoát 0 = sẵn sàng
      stop: ./ci/app-down.sh           # tuỳ chọn; luôn chạy
      test: npx playwright test --reporter=json,list {files}
      logs: [ci/logs/*.log]
    dev:                               # app đã deploy sẵn
      test: E2E_BASE_URL=https://dev.example npx playwright test --reporter=json,list {files}
trigger:
  codePaths: [src/**]
  statusFile: docs/status.md           # tuỳ chọn
gate: { blockedLabel: e2e-blocked }
tracker: { adapter: github, labels: [bug, e2e] }
```

## 5. Thành phần trong TAF

| Thành phần | Việc | AI |
|---|---|---|
| `taf spec` | In cấu trúc spec qua adapter (`--json` cho prompt) | Không |
| `taf lint-tc`, `taf gate`, `taf detect` | Kiểm TC, chặn PR, lấy mã feature | Không |
| `taf plan-gen`, `taf check-paths`, `taf check-script`, `taf rehash` | Chọn feature cần sinh script, kiểm Claude chỉ ghi chỗ được phép, kiểm script khớp TC | Không |
| `taf run` | Chạy target: start → test → stop | Không |
| `taf report`, `taf file-bugs` | Báo cáo theo feature, bug theo fingerprint | Không |
| `taf newly-approved`, `taf init` | Feature vừa được duyệt (để sinh TC), cài TAF vào dự án | Không |
| `prompts/testcase.md`, `script.md`, `triage.md` | Spec → TC, TC → script, phân loại lỗi | Có |

Mọi bước quyết định là code tất định. AI chỉ dùng ở ba chỗ cần đọc hiểu.

## 6. Điều kiện áp dụng

1. Spec có mã truy vết ổn định cho từng thứ cần phủ, và có (hoặc viết được) một spec adapter.
2. Ứng dụng web, test bằng Playwright (report JSON).
3. Dự án có lệnh chạy test không cần tương tác cho từng target.
