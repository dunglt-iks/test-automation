// @ts-check
// Bộ nhãn của định dạng test case. Khoá frontmatter luôn tiếng Anh (feature, spec, specHash,
// status, reviewer, persona); nhãn hiển thị trong thân file và giá trị status theo bộ nhãn.
// Chọn bằng testcases.labels: vi | en | { base: vi, ...ghi đè }.
import { TafError } from "./errors.mjs";

export const LABEL_SETS = {
  vi: {
    trace: "Truy vết",
    persona: "Persona",
    screens: "Màn hình",
    priority: "Ưu tiên",
    preconditions: "Tiền điều kiện",
    testData: "Dữ liệu kiểm tra",
    step: "Bước",
    expected: "Kết quả mong đợi",
    outOfScope: "Ngoài phạm vi e2e",
    code: "Mã",
    reason: "Lý do",
    where: "Kiểm ở đâu",
    draft: "Nháp",
    approved: "Đã duyệt",
  },
  en: {
    trace: "Trace",
    persona: "Persona",
    screens: "Screens",
    priority: "Priority",
    preconditions: "Preconditions",
    testData: "Test data",
    step: "Step",
    expected: "Expected result",
    outOfScope: "Out of e2e scope",
    code: "Code",
    reason: "Reason",
    where: "Covered by",
    draft: "Draft",
    approved: "Approved",
  },
};

/** @param {string | Record<string, string> | undefined} spec */
export function resolveLabels(spec) {
  if (!spec) return LABEL_SETS.vi;
  if (typeof spec === "string") {
    const set = LABEL_SETS[spec];
    if (!set)
      throw new TafError(
        `testcases.labels "${spec}" không có. Có: ${Object.keys(LABEL_SETS).join(", ")}`,
      );
    return set;
  }
  const { base = "vi", ...over } = spec;
  return { ...resolveLabels(base), ...over };
}
