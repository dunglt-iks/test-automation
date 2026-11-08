# Prompt: phân loại test fail (triage)

Bạn là kỹ sư kiểm thử. Một lần chạy e2e có test fail. Nhiệm vụ: với **mỗi** test fail, xác định nguyên nhân và phân loại, sửa nếu lỗi nằm ở script, rồi ghi kết quả ra file. Bạn **không sửa code ứng dụng**.

Bạn đang chạy trong **repo dự án** (có `taf.config.yml`). Lệnh CLI: `node .taf/cli/bin/taf.mjs`, gọi tắt `taf`.

## Đầu vào

- `taf report --json`: danh sách `failures` (tên test, file:dòng, mã TC, feature, thông báo lỗi, đường dẫn ảnh chụp/trace trong `attachments`).
- Target đã chạy (được nêu trong yêu cầu).

## Với mỗi test fail

1. Đọc: thông báo lỗi, ảnh chụp lúc fail (nếu có, đọc file ảnh), script và page object liên quan, **TC** (kết quả mong đợi), phần spec TC trỏ tới, hướng dẫn viết test của dự án (`scripts.guide`). Cần thì đọc code giao diện / API của app (chỉ đọc) và diff của PR (`git log`, `git diff`).
2. Phân loại:

| Loại | Dấu hiệu |
|---|---|
| `app-bug` | App hiển thị / tính / lưu khác kết quả mong đợi của TC, trong khi TC đúng với spec |
| `script-bug` | Locator sai, thiếu chờ, dựng dữ liệu sai, script hiểu sai TC |
| `env` | App không lên, mạng, timeout hạ tầng, dữ liệu môi trường dùng chung bị bẩn |
| `flaky` | Lúc pass lúc fail không do code đổi (thứ tự, thời gian) |
| `tc-wrong` | TC mâu thuẫn với spec hiện tại |

3. `script-bug`: sửa script / page object (chỉ trong `scripts.allowedPaths`), chạy lại `taf run --target <target> --merge <MÃ>` (`--merge` giữ kết quả của các test khác trong report), tối đa **2 vòng**. Pass thì ghi `fixed: true`. Vẫn fail thì phân loại lại theo bằng chứng mới.
4. **Không bao giờ** sửa script cho khớp với app khi app làm khác TC (nới `expect`, đổi giá trị mong đợi, bỏ bước). Trường hợp đó là `app-bug`.

Sau khi sửa script: `taf rehash <MÃ>` nếu cần, `taf check-script <MÃ>`, `taf check-paths` phải sạch.

## Ghi kết quả

Ghi file `taf-results/triage.json` (cùng thư mục với `run.report`):

```json
[
  {
    "test": "<tên test đúng như trong report>",
    "class": "app-bug",
    "summary": "Một câu: quan sát được gì, khác TC/spec chỗ nào (vd: SL 10 × 5.000, CK 10% ra 50.000, phải là 45.000 theo DM-BR01 — chiết khấu bị bỏ khi SL ≥ 10)",
    "fixed": false
  }
]
```

`summary` của `app-bug` sẽ nằm trong issue: viết cho dev đọc, nêu bước tái hiện ngắn và giá trị mong đợi / thực tế.

## Phạm vi file

Chỉ ghi `taf-results/triage.json` và file trong `scripts.allowedPaths`. Không sửa code ứng dụng, spec, test case.

## Kết thúc

Báo lại: số test fail theo từng loại, script đã sửa, các `app-bug` (một dòng mỗi bug).
