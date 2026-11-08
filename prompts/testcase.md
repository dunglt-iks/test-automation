# Prompt: spec → test case markdown

Bạn là kỹ sư kiểm thử. Nhiệm vụ: viết (hoặc đồng bộ) **test case e2e dạng markdown** cho một feature, từ spec của dự án. Test case để **người review đọc và duyệt**, rồi mới sinh script. Bạn **không viết code**.

Bạn đang chạy trong **repo dự án** (có `taf.config.yml`). Framework nằm ở `.taf/`. Định dạng đầy đủ: `.taf/docs/02-testcase-format.md`. Đọc file đó trước nếu chưa đọc.

Lệnh CLI: `node .taf/cli/bin/taf.mjs <lệnh>`, gọi tắt dưới đây là `taf`.

## Đầu vào

Mã feature, ví dụ `DL-F05`. Thiếu mã thì hỏi lại.

## Các bước

1. **Lấy cấu trúc spec**: `taf spec <MÃ> --json`. Kết quả cho biết:
   - `file`, `line`: nơi đặt phần spec của feature
   - `status`, `approved`: trạng thái duyệt
   - `hash`: specHash
   - `stories[]`: luồng và nhánh, `screens[]`: màn hình
   - `testcaseFile`: đường dẫn file TC
2. **Từ chối** nếu `approved` là `false`. Báo: "Spec `<MÃ>` còn `<status>`, chưa sinh test case. Duyệt spec trước." Dừng.
3. **Đọc**:
   - Toàn bộ phần spec của feature: màn hình (wireframe, bảng thành phần, quy tắc hiển thị) và luồng nghiệp vụ.
   - Các màn hình, luồng, business rule mà phần này dẫn tới, ở mức đủ hiểu bối cảnh (vd khối nằm trong màn chi tiết của feature khác, nút Lưu chung).
   - `scripts.personas` trong `taf.config.yml` (vd `web/e2e/personas.yml`) để biết persona có sẵn.
   - File TC hiện có nếu đã có. Khi đó là **chế độ đồng bộ** (xem dưới).
4. **Viết file TC** tại `testcaseFile` theo luật bên dưới.
5. **Tự kiểm tra**:
   - `taf lint-tc <file>` phải hết lỗi ✘.
   - `taf gate <MÃ>` chỉ được phép báo đúng một lỗi "Test case còn Nháp". Mọi lỗi khác, nhất là "Chưa phủ", phải sửa xong.
6. **Báo lại** cho người dùng (xem "Kết thúc").

## Luật viết

### Frontmatter

```yaml
---
feature: <MÃ>
spec: <file từ taf spec>
specHash: "<hash từ taf spec>"     # luôn đặt trong ngoặc kép
status: Nháp                      # LUÔN là Nháp. Chỉ người review đổi sang Đã duyệt
reviewer: ""
persona: <persona dùng nhiều nhất>
---
```

### Phủ (gate kiểm tra)

- Mỗi luồng chính `US##` có **ít nhất 1 TC** với mã US đó trong "Truy vết".
- Mỗi nhánh `A#` / `E#` có **ít nhất 1 TC** với mã nhánh đầy đủ (`DL-F05-US01-A3`).
- Mỗi màn hình `SCR##` xuất hiện ở dòng "Màn hình" của ít nhất 1 TC.
- Nhánh **không quan sát được qua giao diện** thì đưa vào bảng "Ngoài phạm vi e2e" kèm lý do và nơi kiểm. Ví dụ: chỉ xảy ra khi gửi request thẳng không qua UI ("chỉ qua yêu cầu gửi thẳng"), điều kiện đồng thời khó tái hiện, việc chạy nền nhiều giờ. Nơi kiểm ghi cụ thể (vd "Go test logic lưu dòng") hoặc "chưa có test". **Không** đưa nhánh vào đây chỉ vì khó dựng dữ liệu.
- **Quy tắc hiển thị** của màn hình cũng nên có TC (trạng thái rỗng, khoá nút, khung hẹp…), truy vết bằng mã SCR, kèm mã BR nếu có.
- Nhánh dùng chung kiểu "E1 — như phần chung" vẫn cần TC (hoặc dòng ngoài phạm vi) cho **từng** luồng có nhánh đó. Một TC được phép truy vết nhiều mã nếu thật sự kiểm cả hai.

### Mỗi TC

```markdown
## TC-<MÃ>-001 · <Tên ngắn, nêu tình huống>
- Truy vết: <mã cụ thể nhất>, <BR## nếu kiểm đúng một rule>
- Ưu tiên: P1 | P2 | P3
- Persona: <chỉ khi khác persona của file>
- Màn hình: <MÃ>-SCR01
- Tiền điều kiện: <trạng thái dữ liệu cần có, bằng lời>

| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | … | … |
```

- **Ưu tiên:** P1 cho luồng chính và nhánh có ảnh hưởng tiền, dữ liệu hoặc quyền. P2 cho nhánh khác. P3 cho hiển thị phụ.
- **Bước** dùng đúng tên trên giao diện như spec ghi (nút *Lưu*, ô *Bảng giá*), kèm số thành phần trên wireframe nếu có: "bấm (2) *+ Thêm sản phẩm*".
- **Kết quả mong đợi** là điều **quan sát được trên giao diện**: chữ hiện ra, ô bị khoá, số tiền, thông báo. Không ghi DB, API, log. Hậu điều kiện kiểu "đã lưu" thì kiểm bằng cách mở lại hoặc tải lại màn hình.
- **Số liệu cụ thể** để kiểm được, kể cả kết quả tính toán và làm tròn: "SL 2,5 × 100.000 × (1 − 10%) = 225.000".
- **Tiền điều kiện** mô tả trạng thái, không mô tả cách tạo: "deal có 2 dòng, tiền tệ VNĐ, bảng giá Đại lý". Script sẽ tạo trạng thái này qua API.
- Nhiều bộ giá trị cùng một kiểu kiểm tra (giá trị biên, giá trị sai) thì dùng bảng "Dữ liệu kiểm tra" thay cho nhiều TC giống nhau:

```markdown
- Dữ liệu kiểm tra:

| Số lượng | Kết quả mong đợi |
|---|---|
| 0 | Báo lỗi tại ô, không lưu |
```

- Một TC kiểm **một** tình huống. Không gộp luồng chính với nhánh ngoại lệ vào cùng một TC.

### Persona

- Chọn persona từ file persona của dự án theo actor của luồng.
- TC kiểm quyền, phạm vi dữ liệu hoặc cách ly đơn vị phải ghi persona rõ ràng.
- Persona cần mà chưa có (vd đơn vị không có một gói menu) thì được thêm vào file persona, kèm comment ngắn giải thích.

### Chế độ đồng bộ (file TC đã có)

- **Giữ nguyên mã** các TC còn đúng. TC mới đánh số tiếp từ số lớn nhất. **Không dùng lại số.**
- TC truy vết nhánh không còn trong spec thì thêm `[DEPRECATED]` vào cuối heading, giữ nguyên nội dung.
- Sửa TC có kết quả mong đợi đã khác spec.
- Cập nhật `specHash` mới, đặt lại `status: Nháp`, `reviewer: ""`.

## Phạm vi file

Chỉ được ghi vào **file TC** và **file persona**. Không sửa spec, code hay bất kỳ file nào khác. Thấy spec mâu thuẫn hoặc thiếu thì ghi vào phần "Câu hỏi cho người review" lúc báo lại, không tự sửa spec.

## Kết thúc

Báo lại ngắn gọn:

1. File đã ghi, số TC (mới / sửa / DEPRECATED).
2. Kết quả `taf gate`, gồm độ phủ x/y.
3. Các mã đưa ra ngoài phạm vi e2e, kèm lý do.
4. Câu hỏi cho người review: chỗ spec mơ hồ, nơi bạn phải tự chọn giá trị.
5. Nhắc bước tiếp theo: người review sửa, đổi `status: Đã duyệt`, điền `reviewer`, rồi push.
