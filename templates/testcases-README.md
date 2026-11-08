# Test case e2e

Mỗi feature một file `<scope>/<MÃ>.md`, định dạng: `.taf/docs/02-testcase-format.md`.

- Sinh bằng `/testcase <MÃ>` trong Claude Code (hoặc PR nháp tự động khi spec được duyệt).
- Người review sửa, đổi `status` sang đã duyệt, điền `reviewer`. Chỉ TC đã duyệt mới được sinh script.
- Kiểm: `node .taf/cli/bin/taf.mjs lint-tc`, `node .taf/cli/bin/taf.mjs gate <MÃ>`.
