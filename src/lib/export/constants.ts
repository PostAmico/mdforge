/**
 * Export Constants — shared colors, sizes, and margins for PDF/DOCX generation.
 * Colors match the library design system tokens.
 */

// ─── App Colors (from tokens.css) ────────────────────────────────────────────

/** Colors for PDF (with #) and DOCX (without #) */
export const COLORS = {
  // Ink scale
  ink100: { pdf: "#1c1b18", docx: "1C1B18" },
  ink80: { pdf: "#3d3a34", docx: "3D3A34" },
  ink60: { pdf: "#5c584e", docx: "5C584E" },
  ink40: { pdf: "#8a8578", docx: "8A8578" },

  // Accent (Electric Vermillion)
  accent: { pdf: "#e54d2e", docx: "E54D2E" },
  accentSubtle: { pdf: "#fff0ed", docx: "FFF0ED" },
  accentMuted: { pdf: "#fdd8d0", docx: "FDD8D0" },

  // Surfaces
  bgBase: { pdf: "#fafaf7", docx: "FAFAF7" },
  bgSurface2: { pdf: "#f4f3f0", docx: "F4F3F0" },
  bgSurface3: { pdf: "#eceae6", docx: "ECEAE6" },

  // Borders
  borderSubtle: { pdf: "#e8e5de", docx: "E8E5DE" },
  borderDefault: { pdf: "#d4cfc5", docx: "D4CFC5" },

  // White/Black
  white: { pdf: "#ffffff", docx: "FFFFFF" },
  black: { pdf: "#000000", docx: "000000" },
} as const;

/** Chart colors (matches recharts palette in ChartBlockRenderer) */
export const CHART_COLORS = ["#8A2BE2", "#4169E1", "#FF6347", "#2E8B57", "#D4AF37"];

// ─── Page Dimensions ─────────────────────────────────────────────────────────

/** A4 page in PDF points (1 point = 1/72 inch) */
export const PDF_PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 72, // 2.54cm = 1 inch = 72 points
  contentWidth: 595.28 - 144, // 451.28pt
  contentHeight: 841.89 - 144, // 697.89pt
} as const;

/** A4 page in DOCX DXA units (1 DXA = 1/20 point, 1440 DXA = 1 inch) */
export const DOCX_PAGE = {
  width: 11906,
  height: 16838,
  margin: 1440, // 2.54cm = 1 inch = 1440 DXA
  contentWidth: 11906 - 2880, // 9026 DXA
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

/** Font sizes in points */
export const FONT_SIZES = {
  h1: 20,
  h2: 16,
  h3: 13,
  h4: 11.5,
  body: 11,
  small: 9.5,
  code: 10,
} as const;

/** DOCX font sizes (half-points — multiply pt by 2) */
export const DOCX_FONT_SIZES = {
  h1: 40, // 20pt
  h2: 32, // 16pt
  h3: 26, // 13pt
  h4: 23, // 11.5pt
  body: 22, // 11pt
  small: 19, // 9.5pt
  code: 20, // 10pt
} as const;

/** Spacing in PDF points */
export const PDF_SPACING = {
  paragraphGap: 8,
  headingBefore: 18,
  headingAfter: 6,
  listIndent: 20,
  listItemGap: 4,
  codeBlockPadding: 10,
  blockquoteIndent: 15,
  tableRowHeight: 20,
  lineHeight: 1.4,
} as const;

/** Spacing in DOCX (in twentieths of a point for spacing, DXA for indent) */
export const DOCX_SPACING = {
  paragraphAfter: 160, // 8pt
  headingBefore: 360, // 18pt
  headingAfter: 120, // 6pt
  listIndent: 720, // 0.5 inch
  listHanging: 360, // 0.25 inch
} as const;

// ─── Fonts ───────────────────────────────────────────────────────────────────

export const FONTS = {
  pdf: {
    body: "Helvetica",
    bodyBold: "Helvetica-Bold",
    bodyItalic: "Helvetica-Oblique",
    bodyBoldItalic: "Helvetica-BoldOblique",
    mono: "Courier",
    monoBold: "Courier-Bold",
  },
  docx: {
    body: "Arial",
    mono: "Courier New",
  },
} as const;
