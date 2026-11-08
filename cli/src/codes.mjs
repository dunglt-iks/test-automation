// @ts-check
// Nhận diện mã yêu cầu (feature, US, nhánh, SCR, BR) theo featurePattern của dự án.

/** Mã feature: XX-F01 / CORE-C10-F01. */
export function featureRegex(cfg, flags = "g") {
  return new RegExp(
    `(?<![A-Z0-9])(${cfg.spec.featurePattern})(?![0-9])`,
    flags,
  );
}

/** Mã truy vết bất kỳ: feature, US, nhánh A#/E#, SCR, hoặc BR. */
export function traceRegex(cfg) {
  const f = cfg.spec.featurePattern;
  const scope = cfg.spec.scopePattern || f.replace(/-F\\d\{2\}$/, '');
  return new RegExp(
    `(?<![A-Z0-9])((?:${f})(?:-(?:US|SCR)\\d{2}(?:-[AE]\\d+)?)?|(?:${scope})-BR\\d{2})(?![0-9])`,
    "g",
  );
}

/** Phạm vi (addon hoặc capability) của mã feature: DL-F05 → DL, CORE-C10-F01 → CORE-C10. */
export function scopeOf(featureCode) {
  return featureCode.replace(/-F\d{2}$/, "");
}

/** Chữ hoa + áp các luật chuẩn hoá của dự án (vd C11-F04 → CORE-C11-F04 trong tên nhánh). */
export function normalizeText(cfg, text) {
  let s = String(text || "").toUpperCase();
  for (const r of cfg.spec.normalize || [])
    s = s.replace(new RegExp(r.pattern, "g"), r.replace);
  return s;
}

export function extractFeatures(cfg, text) {
  const out = new Set();
  for (const m of normalizeText(cfg, text).matchAll(featureRegex(cfg)))
    out.add(m[1]);
  return [...out];
}

export function extractTraces(cfg, text) {
  const out = [];
  for (const m of String(text || "").matchAll(traceRegex(cfg)))
    if (!out.includes(m[1])) out.push(m[1]);
  return out;
}
