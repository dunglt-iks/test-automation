---
description: Sinh hoặc đồng bộ test case e2e (markdown) từ spec đã duyệt của một feature
argument-hint: <mã feature, vd DL-F05>
---

Mã feature: $ARGUMENTS

Framework TAF phải có ở `.taf/` trong repo này. Chưa có thì dừng và nhắc người dùng chạy:
`git clone https://github.com/dunglt-iks/test-automation .taf` (hoặc `ln -s <đường dẫn clone> .taf`), và thêm `.taf/` vào `.gitignore`.

Đọc `.taf/prompts/testcase.md` rồi làm đúng theo đó với mã feature trên.
