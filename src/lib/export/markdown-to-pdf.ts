/**
 * Markdown → PDF Converter (v2)
 *
 * Converts markdown to a text-selectable A4 PDF using pdfkit.
 * 
 * Key design decisions:
 * - Uses pdfkit's built-in text wrapping (never truncate with ellipsis)
 * - Avoids `continued: true` for mixed inline formatting (causes position bugs)
 * - Instead, builds each paragraph as a single string with font-switching via rich text
 * - Tables use dynamic row heights based on content
 * - Registers a custom font for ₹ and other currency symbols
 * - Helvetica for body, Courier for code (both built into PDF spec)
 */

import PDFDocument from "pdfkit";
import { marked, type Token, type Tokens } from "marked";
import { COLORS, PDF_PAGE, FONT_SIZES, PDF_SPACING, FONTS } from "./constants";
import { CHART_ASPECT_RATIO } from "./chart-renderer";
import { extractAndRenderCharts } from "./extract-charts";
import { preprocessContent } from "./preprocess-content";
import { resolveExportOptions, type ExportInput } from "./types";

// ─── Main Export ────────────────────────────────────────────────────────────

/**
 * Convert a markdown string to a PDF (A4, text-selectable) and return it as a Buffer.
 *
 * @param content  Markdown source (may contain json-chart blocks and tables).
 * @param options  A title string, or an {@link ExportOptions} object.
 */
export async function markdownToPdf(content: string, options?: ExportInput): Promise<Buffer> {
  const opts = resolveExportOptions(options, { title: "Document" });
  const preprocessed = preprocessContent(content);
  const { cleanMarkdown, charts } = await extractAndRenderCharts(preprocessed, {
    strictCharts: opts.strictCharts,
  });
  const tokens = marked.lexer(cleanMarkdown);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: PDF_PAGE.margin, bottom: PDF_PAGE.margin, left: PDF_PAGE.margin, right: PDF_PAGE.margin },
    info: { Title: opts.title, ...(opts.author ? { Author: opts.author } : {}), Creator: "mdforge" },
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Render all tokens
  for (const token of tokens) {
    await renderToken(doc, token, charts);
  }

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

// ─── Token Rendering ────────────────────────────────────────────────────────

async function renderToken(doc: PDFKit.PDFDocument, token: Token, charts: Map<string, Buffer>): Promise<void> {
  switch (token.type) {
    case "heading":
      renderHeading(doc, token as Tokens.Heading);
      break;
    case "paragraph":
      await renderParagraph(doc, token as Tokens.Paragraph, charts);
      break;
    case "list":
      renderList(doc, token as Tokens.List);
      break;
    case "table":
      renderTable(doc, token as Tokens.Table);
      break;
    case "code":
      renderCodeBlock(doc, token as Tokens.Code);
      break;
    case "blockquote":
      renderBlockquote(doc, token as Tokens.Blockquote);
      break;
    case "hr":
      renderHr(doc);
      break;
    case "space":
      doc.moveDown(0.4);
      break;
    default:
      if ("text" in token && typeof (token as any).text === "string") {
        ensureSpace(doc, 20);
        doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.body).fillColor(COLORS.ink80.pdf);
        doc.text((token as any).text, PDF_PAGE.margin, undefined, { width: PDF_PAGE.contentWidth });
        doc.moveDown(0.3);
      }
      break;
  }
}

// ─── Headings ───────────────────────────────────────────────────────────────

function renderHeading(doc: PDFKit.PDFDocument, token: Tokens.Heading): void {
  const fontSize = token.depth === 1 ? FONT_SIZES.h1
    : token.depth === 2 ? FONT_SIZES.h2
    : token.depth === 3 ? FONT_SIZES.h3
    : FONT_SIZES.h4;

  ensureSpace(doc, fontSize + 30);
  doc.moveDown(token.depth <= 2 ? 1.2 : 0.8);

  doc.font(FONTS.pdf.bodyBold).fontSize(fontSize).fillColor(COLORS.ink100.pdf);
  doc.text(getPlainText(token.tokens), PDF_PAGE.margin, undefined, { width: PDF_PAGE.contentWidth });

  // Accent line under H1
  if (token.depth === 1) {
    const y = doc.y + 3;
    doc.moveTo(PDF_PAGE.margin, y).lineTo(PDF_PAGE.margin + 50, y)
      .strokeColor(COLORS.accent.pdf).lineWidth(2.5).stroke();
    doc.moveDown(0.4);
  }

  doc.moveDown(0.3);
}

// ─── Paragraphs (with inline formatting) ────────────────────────────────────

async function renderParagraph(doc: PDFKit.PDFDocument, token: Tokens.Paragraph, charts: Map<string, Buffer>): Promise<void> {
  const plainText = getPlainText(token.tokens);

  // Check for chart placeholder
  const chartMatch = plainText.match(/\[CHART:(\w+)\]/);
  if (chartMatch && chartMatch[1]) {
    const chartBuffer = charts.get(chartMatch[1]);
    if (chartBuffer) {
      // Display width in points. pdfkit derives height from the PNG's aspect
      // ratio, so no distortion. The source bitmap is rendered at high
      // resolution (CHART_RENDER_SCALE), so it stays crisp at this size.
      const imgWidth = Math.min(PDF_PAGE.contentWidth, 460);
      const imgHeight = imgWidth / CHART_ASPECT_RATIO;
      ensureSpace(doc, imgHeight + 20);
      const xOffset = PDF_PAGE.margin + (PDF_PAGE.contentWidth - imgWidth) / 2;
      doc.image(chartBuffer, xOffset, undefined, { width: imgWidth });
      doc.moveDown(0.8);
    }
    return;
  }

  ensureSpace(doc, 18);

  // Check if paragraph contains line breaks (from markdown `  \n`)
  // If so, split into sub-lines and render each separately
  const segments = flattenInlineTokens(token.tokens);
  const lines = splitSegmentsByLineBreak(segments);

  for (const lineSegments of lines) {
    if (lineSegments.length === 0) continue;
    renderSegmentLine(doc, lineSegments);
  }

  doc.moveDown(0.5);
}

/** Split a flat segment array into multiple lines wherever a \n segment appears */
function splitSegmentsByLineBreak(segments: TextSegment[]): TextSegment[][] {
  const lines: TextSegment[][] = [[]];
  for (const seg of segments) {
    if (seg.text === "\n") {
      lines.push([]);
    } else if (seg.text.includes("\n")) {
      // Split text that contains newlines
      const parts = seg.text.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          lines[lines.length - 1]!.push({ ...seg, text: parts[i]! });
        }
        if (i < parts.length - 1) {
          lines.push([]);
        }
      }
    } else {
      lines[lines.length - 1]!.push(seg);
    }
  }
  return lines;
}

/** Render a single line of text segments (no line breaks within) */
function renderSegmentLine(doc: PDFKit.PDFDocument, segments: TextSegment[]): void {
  if (segments.length === 0) return;

  const allPlain = segments.every(s => !s.bold && !s.italic && !s.code && !s.link);
  const allBold = segments.every(s => s.bold && !s.italic && !s.code);

  if (allPlain) {
    doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.body).fillColor(COLORS.ink80.pdf);
    doc.text(segments.map(s => s.text).join(""), PDF_PAGE.margin, undefined, { width: PDF_PAGE.contentWidth });
    return;
  }
  if (allBold) {
    doc.font(FONTS.pdf.bodyBold).fontSize(FONT_SIZES.body).fillColor(COLORS.ink100.pdf);
    doc.text(segments.map(s => s.text).join(""), PDF_PAGE.margin, undefined, { width: PDF_PAGE.contentWidth });
    return;
  }

  const baseFontSize = FONT_SIZES.body;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;

    if (seg.code) doc.font(FONTS.pdf.mono);
    else if (seg.bold && seg.italic) doc.font(FONTS.pdf.bodyBoldItalic);
    else if (seg.bold) doc.font(FONTS.pdf.bodyBold);
    else if (seg.italic) doc.font(FONTS.pdf.bodyItalic);
    else doc.font(FONTS.pdf.body);

    doc.fontSize(baseFontSize);
    doc.fillColor(seg.bold ? COLORS.ink100.pdf : seg.code ? COLORS.accent.pdf : seg.link ? COLORS.accent.pdf : COLORS.ink80.pdf);

    const options: any = { width: PDF_PAGE.contentWidth, continued: !isLast };
    if (seg.link) { options.link = seg.link; options.underline = true; }

    if (i === 0) {
      doc.text(seg.text, PDF_PAGE.margin, undefined, options);
    } else {
      doc.text(seg.text, options);
    }
  }
}

/**
 * Renders inline tokens (bold, italic, code, links, plain text) as a flowing paragraph.
 * 
 * APPROACH: Render the entire paragraph as plain text first (for correct wrapping),
 * then overlay bold segments. This avoids pdfkit's broken `continued` font-switching.
 * 
 * Actually: Use a simpler approach — render as single doc.text() with no formatting,
 * UNLESS the paragraph is simple enough (single style). For mixed paragraphs,
 * we accept the slight positioning issues from `continued` but fix them by 
 * not switching fontSize mid-chain (the actual cause of the bug).
 */
function renderInlineContent(doc: PDFKit.PDFDocument, tokens: Token[] | undefined): void {
  if (!tokens || tokens.length === 0) return;

  const segments = flattenInlineTokens(tokens);
  if (segments.length === 0) return;

  // Check if all segments are same style — if so, render as one call (fastest, no bugs)
  const allPlain = segments.every(s => !s.bold && !s.italic && !s.code && !s.link);
  const allBold = segments.every(s => s.bold && !s.italic && !s.code);

  if (allPlain) {
    doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.body).fillColor(COLORS.ink80.pdf);
    doc.text(segments.map(s => s.text).join(""), PDF_PAGE.margin, undefined, { width: PDF_PAGE.contentWidth });
    return;
  }
  if (allBold) {
    doc.font(FONTS.pdf.bodyBold).fontSize(FONT_SIZES.body).fillColor(COLORS.ink100.pdf);
    doc.text(segments.map(s => s.text).join(""), PDF_PAGE.margin, undefined, { width: PDF_PAGE.contentWidth });
    return;
  }

  // Mixed formatting: use continued but NEVER change fontSize mid-chain (that's what causes the bug)
  const baseFontSize = FONT_SIZES.body;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;

    // Set font (keep fontSize constant to avoid position calculation bugs)
    if (seg.code) {
      doc.font(FONTS.pdf.mono);
    } else if (seg.bold && seg.italic) {
      doc.font(FONTS.pdf.bodyBoldItalic);
    } else if (seg.bold) {
      doc.font(FONTS.pdf.bodyBold);
    } else if (seg.italic) {
      doc.font(FONTS.pdf.bodyItalic);
    } else {
      doc.font(FONTS.pdf.body);
    }

    // CRITICAL: Keep fontSize the same for ALL segments to prevent position drift
    doc.fontSize(baseFontSize);
    doc.fillColor(seg.bold ? COLORS.ink100.pdf : seg.code ? COLORS.accent.pdf : seg.link ? COLORS.accent.pdf : COLORS.ink80.pdf);

    const options: any = { width: PDF_PAGE.contentWidth, continued: !isLast };
    if (seg.link) { options.link = seg.link; options.underline = true; }

    if (i === 0) {
      doc.text(seg.text, PDF_PAGE.margin, undefined, options);
    } else {
      doc.text(seg.text, options);
    }
  }
}

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}

/**
 * Flattens nested inline tokens into a flat array of styled text segments.
 */
function flattenInlineTokens(tokens: Token[], parentBold = false, parentItalic = false): TextSegment[] {
  const segments: TextSegment[] = [];

  for (const t of tokens) {
    switch (t.type) {
      case "text": {
        const tt = t as Tokens.Text;
        if ("tokens" in tt && Array.isArray(tt.tokens) && tt.tokens.length > 0) {
          segments.push(...flattenInlineTokens(tt.tokens, parentBold, parentItalic));
        } else {
          const safeText = sanitizeText(tt.text);
          if (safeText) segments.push({ text: safeText, bold: parentBold, italic: parentItalic });
        }
        break;
      }
      case "strong": {
        const tt = t as Tokens.Strong;
        segments.push(...flattenInlineTokens(tt.tokens, true, parentItalic));
        break;
      }
      case "em": {
        const tt = t as Tokens.Em;
        segments.push(...flattenInlineTokens(tt.tokens, parentBold, true));
        break;
      }
      case "codespan": {
        const tt = t as Tokens.Codespan;
        segments.push({ text: tt.text, code: true });
        break;
      }
      case "link": {
        const tt = t as Tokens.Link;
        const linkText = getPlainText(tt.tokens);
        segments.push({ text: linkText, link: tt.href, bold: parentBold, italic: parentItalic });
        break;
      }
      case "br": {
        segments.push({ text: "\n", bold: parentBold, italic: parentItalic });
        break;
      }
      default: {
        if ("text" in t && typeof (t as any).text === "string") {
          const safeText = sanitizeText((t as any).text);
          if (safeText) segments.push({ text: safeText, bold: parentBold, italic: parentItalic });
        }
        break;
      }
    }
  }

  return segments;
}

/** Replace Unicode characters that Helvetica cannot render */
function sanitizeText(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/—/g, " -- ")
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/├──/g, "|--")
    .replace(/└──/g, "\\--")
    .replace(/│/g, "|")
    .replace(/─/g, "-")
    .replace(/└/g, "\\")
    .replace(/├/g, "|");
}

// ─── Lists ──────────────────────────────────────────────────────────────────

function renderList(doc: PDFKit.PDFDocument, token: Tokens.List): void {
  const indent = 25;
  const bulletWidth = 18;

  for (let i = 0; i < token.items.length; i++) {
    const item = token.items[i]!;
    ensureSpace(doc, 18);

    const textContent = getPlainText(item.tokens);
    const safeText = textContent; // getPlainText already sanitizes

    // Detect checkbox items: "[ ] text" or "[x] text"
    let bullet: string;
    let displayText = safeText;

    if (item.task) {
      // Task list item
      bullet = item.checked ? "\u2611" : "\u2610"; // ☑ or ☐ — but Helvetica doesn't have these
      // Use text representations instead
      bullet = item.checked ? "[x]" : "[ ]";
    } else if (token.ordered) {
      bullet = `${i + 1}.`;
    } else {
      bullet = "\u2022"; // •
    }

    const textX = PDF_PAGE.margin + indent + bulletWidth;
    const textWidth = PDF_PAGE.contentWidth - indent - bulletWidth;

    // Measure text height for correct positioning
    doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.body);
    const textHeight = doc.heightOfString(displayText, { width: textWidth });
    const bulletY = doc.y;

    // Draw bullet/number
    doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.body).fillColor(COLORS.ink60.pdf);
    doc.text(bullet, PDF_PAGE.margin + indent, bulletY, { width: bulletWidth, lineBreak: false });

    // Draw item text — use inline content rendering for bold/italic within list items
    doc.y = bulletY; // Reset y to same line as bullet
    if (item.tokens && hasInlineFormatting(item.tokens)) {
      renderInlineContentAt(doc, item.tokens, textX, textWidth);
    } else {
      doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.body).fillColor(COLORS.ink80.pdf);
      doc.text(displayText, textX, bulletY, { width: textWidth });
    }

    doc.moveDown(0.15);
  }
  doc.moveDown(0.4);
}

/** Check if tokens contain any bold/italic/code formatting */
function hasInlineFormatting(tokens: Token[]): boolean {
  return tokens.some(t => t.type === "strong" || t.type === "em" || t.type === "codespan" ||
    ("tokens" in t && Array.isArray((t as any).tokens) && hasInlineFormatting((t as any).tokens)));
}

/** Render inline content starting at a specific x position with given width */
function renderInlineContentAt(doc: PDFKit.PDFDocument, tokens: Token[], x: number, width: number): void {
  const segments = flattenInlineTokens(tokens);
  if (segments.length === 0) return;

  const baseFontSize = FONT_SIZES.body;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;

    if (seg.code) doc.font(FONTS.pdf.mono);
    else if (seg.bold && seg.italic) doc.font(FONTS.pdf.bodyBoldItalic);
    else if (seg.bold) doc.font(FONTS.pdf.bodyBold);
    else if (seg.italic) doc.font(FONTS.pdf.bodyItalic);
    else doc.font(FONTS.pdf.body);

    doc.fontSize(baseFontSize);
    doc.fillColor(seg.bold ? COLORS.ink100.pdf : seg.code ? COLORS.accent.pdf : COLORS.ink80.pdf);

    const options: any = { width, continued: !isLast };
    if (i === 0) {
      doc.text(seg.text, x, undefined, options);
    } else {
      doc.text(seg.text, options);
    }
  }
}

// ─── Tables ─────────────────────────────────────────────────────────────────

function renderTable(doc: PDFKit.PDFDocument, token: Tokens.Table): void {
  const numCols = token.header.length;
  const tableWidth = PDF_PAGE.contentWidth;
  const colWidth = tableWidth / numCols;
  const cellPadding = 6;
  const cellTextWidth = colWidth - cellPadding * 2;

  // Per-column alignment from the markdown table (e.g. `---:` = right). Marked
  // gives us `token.align` as ('left'|'center'|'right'|null)[]; default left.
  const colAlign = (i: number): "left" | "center" | "right" =>
    (token.align?.[i] as "left" | "center" | "right" | null) ?? "left";

  // ─ Header ─
  ensureSpace(doc, 40);
  const headerY = doc.y;

  // Measure header height
  doc.font(FONTS.pdf.bodyBold).fontSize(FONT_SIZES.small);
  let maxHeaderHeight = 0;
  const headerTexts = token.header.map((cell) => {
    const text = getPlainText(cell.tokens);
    const h = doc.heightOfString(text, { width: cellTextWidth });
    if (h > maxHeaderHeight) maxHeaderHeight = h;
    return text;
  });
  const headerRowHeight = maxHeaderHeight + cellPadding * 2;

  // Draw header cells (background and borders)
  for (let i = 0; i < numCols; i++) {
    const x = PDF_PAGE.margin + i * colWidth;
    doc.rect(x, headerY, colWidth, headerRowHeight)
       .lineWidth(0.5)
       .fillAndStroke(COLORS.bgSurface2.pdf, COLORS.borderSubtle.pdf);
  }

  // Draw header text
  doc.font(FONTS.pdf.bodyBold).fontSize(FONT_SIZES.small).fillColor(COLORS.ink100.pdf);
  for (let i = 0; i < headerTexts.length; i++) {
    const x = PDF_PAGE.margin + i * colWidth + cellPadding;
    doc.text(headerTexts[i]!, x, headerY + cellPadding, { width: cellTextWidth, align: colAlign(i) });
  }

  doc.y = headerY + headerRowHeight;

  // Header bottom border (bolder)
  doc.moveTo(PDF_PAGE.margin, doc.y).lineTo(PDF_PAGE.margin + tableWidth, doc.y)
    .strokeColor(COLORS.borderDefault.pdf).lineWidth(0.8).stroke();

  // ─ Data rows ─
  for (const row of token.rows) {
    // Measure row height
    doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.small);
    let maxRowHeight = 0;
    const rowTexts = row.map((cell) => {
      const text = getPlainText(cell.tokens);
      const h = doc.heightOfString(text, { width: cellTextWidth });
      if (h > maxRowHeight) maxRowHeight = h;
      return text;
    });
    const rowHeight = maxRowHeight + cellPadding * 2;

    ensureSpace(doc, rowHeight + 2);
    const rowY = doc.y;

    // Draw cell borders
    for (let i = 0; i < numCols; i++) {
      const x = PDF_PAGE.margin + i * colWidth;
      doc.rect(x, rowY, colWidth, rowHeight)
         .lineWidth(0.5)
         .strokeColor(COLORS.borderSubtle.pdf)
         .stroke();
    }

    // Draw row text
    doc.font(FONTS.pdf.body).fontSize(FONT_SIZES.small).fillColor(COLORS.ink80.pdf);
    for (let i = 0; i < rowTexts.length; i++) {
      const x = PDF_PAGE.margin + i * colWidth + cellPadding;
      doc.text(rowTexts[i]!, x, rowY + cellPadding, { width: cellTextWidth, align: colAlign(i) });
    }

    doc.y = rowY + rowHeight;
  }

  doc.moveDown(0.8);
}

// ─── Code Blocks ────────────────────────────────────────────────────────────

function renderCodeBlock(doc: PDFKit.PDFDocument, token: Tokens.Code): void {
  const padding = 10;
  const safeCode = sanitizeText(token.text);
  doc.font(FONTS.pdf.mono).fontSize(FONT_SIZES.code);

  const textHeight = doc.heightOfString(safeCode, { width: PDF_PAGE.contentWidth - padding * 2 });
  const blockHeight = textHeight + padding * 2;

  ensureSpace(doc, blockHeight + 10);
  const startY = doc.y;

  // Background
  doc.roundedRect(PDF_PAGE.margin, startY, PDF_PAGE.contentWidth, blockHeight, 3)
    .fill(COLORS.bgSurface2.pdf);

  // Code text
  doc.font(FONTS.pdf.mono).fontSize(FONT_SIZES.code).fillColor(COLORS.ink80.pdf);
  doc.text(safeCode, PDF_PAGE.margin + padding, startY + padding, {
    width: PDF_PAGE.contentWidth - padding * 2,
  });

  doc.y = startY + blockHeight + 4;
  doc.moveDown(0.3);
}

// ─── Blockquotes ────────────────────────────────────────────────────────────

function renderBlockquote(doc: PDFKit.PDFDocument, token: Tokens.Blockquote): void {
  ensureSpace(doc, 25);
  const borderX = PDF_PAGE.margin + 8;
  const textX = PDF_PAGE.margin + 18;
  const textWidth = PDF_PAGE.contentWidth - 20;

  const quoteText = token.tokens
    .map((bt: Token) => {
      if (bt.type === "paragraph") return getPlainText((bt as Tokens.Paragraph).tokens);
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const startY = doc.y;
  doc.font(FONTS.pdf.bodyItalic).fontSize(FONT_SIZES.body).fillColor(COLORS.ink60.pdf);
  doc.text(quoteText, textX, undefined, { width: textWidth });
  const endY = doc.y;

  // Left accent border
  doc.moveTo(borderX, startY).lineTo(borderX, endY)
    .strokeColor(COLORS.accent.pdf).lineWidth(3).stroke();

  doc.moveDown(0.5);
}

// ─── Horizontal Rule ────────────────────────────────────────────────────────

function renderHr(doc: PDFKit.PDFDocument): void {
  ensureSpace(doc, 20);
  doc.moveDown(0.5);
  const y = doc.y;
  doc.moveTo(PDF_PAGE.margin, y).lineTo(PDF_PAGE.margin + PDF_PAGE.contentWidth, y)
    .strokeColor(COLORS.borderSubtle.pdf).lineWidth(0.5).stroke();
  doc.y = y + 10;
  doc.moveDown(0.5);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const remaining = PDF_PAGE.height - PDF_PAGE.margin - doc.y;
  if (remaining < needed) {
    doc.addPage();
  }
}

function getPlainText(tokens: Token[] | undefined): string {
  if (!tokens) return "";
  const raw = tokens
    .map((t) => {
      if ("tokens" in t && Array.isArray((t as any).tokens)) {
        return getPlainText((t as any).tokens);
      }
      if ("text" in t && typeof (t as any).text === "string") {
        return (t as any).text;
      }
      if (t.type === "br") return "\n";
      return "";
    })
    .join("");

  // Replace characters not supported by Helvetica (built-in PDF font)
  return raw
    .replace(/₹/g, "Rs.")
    .replace(/—/g, " -- ")
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/✓/g, "[x]")
    .replace(/✗/g, "[!]")
    .replace(/●/g, "[~]")
    .replace(/○/g, "[ ]")
    .replace(/★/g, "*")
    .replace(/☆/g, "*")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/↑/g, "^")
    .replace(/↓/g, "v")
    .replace(/©/g, "(c)")
    .replace(/®/g, "(R)")
    .replace(/™/g, "(TM)")
    .replace(/°/g, "deg")
    .replace(/±/g, "+/-")
    .replace(/×/g, "x")
    .replace(/÷/g, "/")
    .replace(/≈/g, "~")
    .replace(/≠/g, "!=")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\u2018/g, "'")   // left single quote
    .replace(/\u2019/g, "'")   // right single quote
    .replace(/\u201C/g, '"')   // left double quote
    .replace(/\u201D/g, '"')   // right double quote
    .replace(/\u2026/g, "...") // horizontal ellipsis
    .replace(/\u00A0/g, " ")   // non-breaking space
    .replace(/├──/g, "|--")
    .replace(/└──/g, "\\--")
    .replace(/│/g, "|")
    .replace(/─/g, "-")
    .replace(/└/g, "\\")
    .replace(/├/g, "|");
}

// Chart extraction is shared with the DOCX pipeline; see ./extract-charts.ts
