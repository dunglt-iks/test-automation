// @ts-check
// Tìm mã yêu cầu trong văn bản. Mẫu mã do spec adapter quyết định (cfg.adapter.featureRegex /
// traceRegex); lõi chỉ chuẩn hoá văn bản và gom kết quả.

/** Chữ hoa + áp các luật chuẩn hoá của dự án (spec.normalize, vd C11-F04 → CORE-C11-F04). */
export function normalizeText(cfg, text) {
  let s = String(text || "").toUpperCase();
  for (const r of cfg.spec.normalize || [])
    s = s.replace(new RegExp(r.pattern, "g"), r.replace);
  return s;
}

function collect(re, text) {
  const out = [];
  for (const m of String(text || "").matchAll(re)) {
    const v = m[1] ?? m[0];
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Mã feature trong tiêu đề, tên nhánh, commit… (không phân biệt hoa thường). */
export function extractFeatures(cfg, text) {
  return collect(cfg.adapter.featureRegex(), normalizeText(cfg, text));
}

/** Mã truy vết (feature, luồng, nhánh, màn hình, rule…) trong test case, giữ nguyên chữ. */
export function extractTraces(cfg, text) {
  return collect(cfg.adapter.traceRegex(), text);
}

/** Thư mục con chứa TC của feature (vd DL-F05 → DL). */
export function scopeOf(cfg, featureCode) {
  return cfg.adapter.scopeOf(featureCode);
}
