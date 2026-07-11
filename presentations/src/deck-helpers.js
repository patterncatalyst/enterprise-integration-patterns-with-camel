// deck-helpers.js — design system & helpers for the REST deck
// Carries the visual conventions from the existing Python deck:
//   - 13.333 x 7.5 LAYOUT_WIDE
//   - Eyebrow 12pt bold red EE0000, charSpacing 4
//   - Title 30pt Overpass SemiBold #151515
//   - Content 17pt Red Hat Text #242424
//   - Code box fill #151515, code 11pt Red Hat Mono, fg #E6E6E6, comments #8FB98F
//   - Section dividers: bg #AB0000 with section-panel.png on left and white logo
//   - Caption 13pt italic #5A5A5A; page number 10pt #8A8A8A

"use strict";

const PptxGenJS = require("pptxgenjs");
const path = require("path");

const PNG = process.env.DECK_PNG || "./png";
const ASSETS = process.env.DECK_ASSETS || "./assets";

const COLOR = {
  red:        "EE0000",
  redDark:    "AB0000",
  redDeep:    "B71C1C",
  ink:        "151515",
  body:       "242424",
  caption:    "5A5A5A",
  pageNum:    "8A8A8A",
  grid:       "D2D2D2",
  panel:      "F4F4F4",
  codeBg:     "151515",
  codeFg:     "E6E6E6",
  codeComment:"8FB98F",
  codeKey:    "FFC36C",
  codeStr:    "E2CFA2",
  codeDecor:  "97C0FF",
  white:      "FFFFFF",
  rule:       "EE0000",
  // accent palette for callouts
  svc:        "0066CC",
  data:       "6A1B9A",
  platform:   "006E6E",
  govern:     "B36B00",
  amber:      "FFA000",
  // perf callout accent
  perfBg:     "FFF7E6",
  perfBorder: "B36B00",
};

const FONT = {
  title:   "Overpass",
  titleFb: "Calibri",
  body:    "Red Hat Text",
  bodyFb:  "Calibri",
  mono:    "Red Hat Mono",
  monoFb:  "Consolas",
};

// Slide dimensions in inches (LAYOUT_WIDE)
const W = 13.333;
const H = 7.5;

// ----- helpers -----
function newDeck() {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "Designing Cloud-Native REST APIs — Python";
  pres.author = "Robert Sedor";
  pres.company = "Red Hat";
  return pres;
}

// Footer: red Hat-style page number + small logo on every content slide.
function addFooter(slide, pageNum) {
  // page number (bottom-left)
  slide.addText(String(pageNum), {
    x: 0.62, y: 6.96, w: 1.0, h: 0.30,
    fontFace: FONT.body, fontSize: 10, color: COLOR.pageNum,
    align: "left", valign: "middle",
  });
  // Red Hat color logo, bottom-right — present on every content slide
  // (the cover and section dividers carry their own logo separately).
  try {
    slide.addImage({
      path: `${ASSETS}/logo-candidate-2.png`,
      x: 11.55, y: 6.95, w: 1.13, h: 0.27,
    });
  } catch (e) { /* ok if missing */ }
}

function addContentTitle(slide, eyebrow, title, opts = {}) {
  slide.addText(eyebrow, {
    x: 0.62, y: 0.42, w: opts.eyebrowW ?? 12.09, h: 0.32,
    fontFace: FONT.title, fontSize: 12, bold: true, color: COLOR.red,
    charSpacing: 4,
    align: "left", valign: "middle",
  });
  slide.addText(title, {
    x: 0.62, y: 0.74, w: opts.w ?? 12.09, h: opts.h ?? 1.10,
    fontFace: FONT.title, fontSize: opts.fontSize ?? 30, bold: true, color: COLOR.ink,
    align: "left", valign: "top",
  });
}

function addBullets(slide, lines, opts = {}) {
  const x = opts.x ?? 0.62;
  const y = opts.y ?? 1.85;
  const w = opts.w ?? 12.09;
  const h = opts.h ?? 4.85;
  const fontSize = opts.fontSize ?? 17;
  const indentSize = 8;
  // pptxgenjs accepts an array of {text, options:{bullet}} objects
  const items = lines.map((ln) => {
    if (typeof ln === "string") {
      return { text: ln, options: { bullet: { code: "25CF" }, paraSpaceAfter: 6, breakLine: true } };
    }
    // already a structured object; pass through with reasonable defaults
    return {
      text: ln.text,
      options: {
        bullet: ln.sub ? { indent: indentSize, code: "25E6" } : { code: "25CF" },
        paraSpaceAfter: 4,
        breakLine: true,
        indentLevel: ln.sub ? 1 : 0,
        ...(ln.options || {}),
      },
    };
  });
  slide.addText(items, {
    x, y, w, h,
    fontFace: FONT.body, fontSize, color: COLOR.body,
    align: "left", valign: "top",
    paraSpaceAfter: 6,
    lineSpacingMultiple: 1.15,
  });
}

// Two-column bullets — matches the reference deck's agenda layout.
// `left` and `right` are arrays of strings (or {text, options} objects).
// `muted` indicates items to render in muted italic style (e.g. appendices).
function addTwoColBullets(slide, left, right, opts = {}) {
  const y = opts.y ?? 1.85;
  const h = opts.h ?? 4.85;
  const fontSize = opts.fontSize ?? 17;

  function mk(items) {
    return items.map((ln) => {
      if (typeof ln === "string") {
        return { text: ln, options: { bullet: { code: "25CF" }, paraSpaceAfter: 8, breakLine: true } };
      }
      return {
        text: ln.text,
        options: {
          bullet: { code: "25CF" },
          paraSpaceAfter: 8,
          breakLine: true,
          italic: !!ln.muted,
          color: ln.muted ? COLOR.caption : COLOR.body,
          ...(ln.options || {}),
        },
      };
    });
  }

  slide.addText(mk(left), {
    x: 0.62, y, w: 6.00, h,
    fontFace: FONT.body, fontSize, color: COLOR.body,
    align: "left", valign: "top",
    paraSpaceAfter: 8, lineSpacingMultiple: 1.20,
  });
  slide.addText(mk(right), {
    x: 7.02, y, w: 6.00, h,
    fontFace: FONT.body, fontSize, color: COLOR.body,
    align: "left", valign: "top",
    paraSpaceAfter: 8, lineSpacingMultiple: 1.20,
  });
}

// Status-code table: 3-column layout — code | name | purpose
// Designed for the 2xx/4xx/5xx slides so the bullets-as-prose pattern can be retired.
function addStatusTable(slide, rows, opts = {}) {
  const y = opts.y ?? 1.85;
  const h = opts.h ?? (opts.withCallout ? 3.55 : 4.85);

  const tableRows = rows.map((r) => [
    {
      text: r.code,
      options: {
        bold: true, color: r.codeColor || COLOR.red,
        fontFace: FONT.mono, fontSize: 15,
        align: "left", valign: "middle",
      },
    },
    {
      text: r.name,
      options: {
        bold: true, color: COLOR.ink,
        fontFace: FONT.body, fontSize: 14,
        align: "left", valign: "middle",
      },
    },
    {
      text: r.purpose,
      options: {
        color: COLOR.body,
        fontFace: FONT.body, fontSize: 13,
        align: "left", valign: "middle",
      },
    },
  ]);

  slide.addTable(tableRows, {
    x: 0.62, y, w: 12.09, h,
    fontFace: FONT.body,
    color: COLOR.body,
    border: { type: "solid", color: COLOR.grid, pt: 0.5 },
    valign: "middle",
    // Default 3-column widths suit short status codes in column 1. Reference
    // tables (Appendix A/B) pass a wider colW so long labels (e.g. test-type
    // names, CLI names) don't wrap. Widths should sum to ~12.09 (the table w).
    colW: opts.colW ?? [1.10, 2.40, 8.59],
    rowH: opts.rowH ?? 0.45,
  });
}

function addCaption(slide, text, y) {
  slide.addText(text, {
    x: 0.62, y: y ?? 6.50, w: 12.09, h: 0.34,
    fontFace: FONT.body, fontSize: 13, italic: true, color: COLOR.caption,
    align: "center", valign: "middle",
  });
}

function addPerfCallout(slide, text, opts = {}) {
  // Distinctive "perf" sidebar — amber tint, left bar, eyebrow "⚡ PERFORMANCE"
  const x = opts.x ?? 0.62;
  const y = opts.y ?? 5.65;
  const w = opts.w ?? 12.09;
  const h = opts.h ?? 0.80;
  // background panel
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: COLOR.perfBg },
    line: { color: COLOR.perfBorder, width: 0 },
  });
  // left accent bar
  slide.addShape("rect", {
    x, y, w: 0.06, h,
    fill: { color: COLOR.perfBorder },
    line: { color: COLOR.perfBorder, width: 0 },
  });
  // eyebrow text + body, stacked
  slide.addText([
    { text: "⚡  PERFORMANCE", options: {
        fontFace: FONT.title, fontSize: 10, bold: true, color: COLOR.perfBorder,
        charSpacing: 3, breakLine: true,
    }},
    { text: text, options: {
        fontFace: FONT.body, fontSize: 13, color: COLOR.body,
    }},
  ], {
    x: x + 0.20, y: y + 0.04, w: w - 0.30, h: h - 0.08,
    align: "left", valign: "middle",
  });
}

function addDiagramSlide(slide, eyebrow, title, pngName, caption, opts = {}) {
  addContentTitle(slide, eyebrow, title);
  const x = opts.x ?? 1.80;
  const y = opts.y ?? 1.75;
  const w = opts.w ?? 9.74;
  const h = opts.h ?? 4.75;
  slide.addImage({
    path: `${PNG}/${pngName}.png`,
    x, y, w, h,
    sizing: { type: "contain", w, h },
  });
  if (caption) addCaption(slide, caption);
}

// language eyebrow chip (right-aligned, above the code box)
function addLangChip(slide, label) {
  // Right-aligned, on the same vertical band as the title row
  slide.addText(label, {
    x: 8.62, y: 1.06, w: 4.09, h: 0.30,
    fontFace: FONT.mono, fontSize: 11, bold: true, color: COLOR.caption,
    charSpacing: 2,
    align: "right", valign: "middle",
  });
}

function addCodeSlide(slide, eyebrow, title, lang, codeLines, caption, opts = {}) {
  // If a language chip is present, narrow the title so it doesn't run under the chip.
  addContentTitle(slide, eyebrow, title, lang ? { w: 7.90 } : {});
  if (lang) addLangChip(slide, lang);
  // dark code box
  const x = opts.x ?? 0.62;
  const y = opts.y ?? 1.85;
  const w = opts.w ?? 12.09;
  const h = opts.h ?? 4.65;
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: COLOR.codeBg },
    line: { color: COLOR.codeBg, width: 0 },
  });
  // code text — render each line with simple syntax coloring (comments green)
  const items = codeLines.map((ln) => {
    const trimmed = ln.replace(/^\s+/, "");
    const isComment = trimmed.startsWith("#") || trimmed.startsWith("//");
    return {
      text: ln + "\n",
      options: {
        fontFace: FONT.mono,
        fontSize: opts.fontSize ?? 11,
        color: isComment ? COLOR.codeComment : COLOR.codeFg,
        breakLine: false,
      },
    };
  });
  slide.addText(items, {
    x: x + 0.20, y: y + 0.10, w: w - 0.40, h: h - 0.20,
    fontFace: FONT.mono, fontSize: opts.fontSize ?? 11, color: COLOR.codeFg,
    align: "left", valign: "top",
    paraSpaceAfter: 0,
    lineSpacingMultiple: 1.10,
  });
  if (caption) {
    // When the code box is taller than default, push the caption below it.
    const codeBottom = y + h;
    const captionY = codeBottom > 6.50 ? codeBottom + 0.06 : 6.50;
    addCaption(slide, caption, captionY);
  }
}

function addSectionDivider(slide, code, title, subtitle) {
  // background — solid red, matches Python deck
  slide.background = { color: COLOR.redDark };
  // section-panel.png covers full slide (textured red)
  try {
    slide.addImage({
      path: `${ASSETS}/section-panel.png`,
      x: 0, y: 0, w: W, h: H,
    });
  } catch (e) { /* ok if missing */ }
  // section code (e.g. "00")
  slide.addText(code, {
    x: 6.27, y: 2.32, w: 6.40, h: 0.50,
    fontFace: FONT.title, fontSize: 22, bold: true, color: COLOR.white,
    charSpacing: 6,
    align: "left", valign: "middle",
  });
  // title
  slide.addText(title, {
    x: 6.24, y: 2.84, w: 6.70, h: 1.60,
    fontFace: FONT.title, fontSize: 44, bold: true, color: COLOR.white,
    align: "left", valign: "top",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 6.27, y: 4.55, w: 6.60, h: 0.80,
      fontFace: FONT.body, fontSize: 16, italic: true, color: "FFD9D9",
      align: "left", valign: "top",
    });
  }
  // white logo bottom right
  try {
    slide.addImage({
      path: `${ASSETS}/redhat-logo-white.png`,
      x: 11.42, y: 6.88, w: 1.33, h: 0.31,
    });
  } catch (e) { /* ok */ }
}

function addNotes(slide, text) {
  slide.addNotes(text);
}

// Pattern card: EIP icon on the left, problem/solution text on the right.
// `icon` is a PNG filename (without .png) looked up in `PNG/eip-icons/`.
// `problem` and `solution` are short strings (1–3 sentences each).
function addPatternCard(slide, eyebrow, title, icon, problem, solution, opts = {}) {
  addContentTitle(slide, eyebrow, title);
  const iconX = opts.iconX ?? 0.82;
  const iconY = opts.iconY ?? 2.10;
  const iconSize = opts.iconSize ?? 2.80;
  try {
    slide.addImage({
      path: `${PNG}/eip-icons/${icon}.png`,
      x: iconX, y: iconY, w: iconSize, h: iconSize,
      sizing: { type: "contain", w: iconSize, h: iconSize },
    });
  } catch (e) { /* ok if icon missing */ }
  // light panel behind icon
  slide.addShape("rect", {
    x: iconX - 0.15, y: iconY - 0.10, w: iconSize + 0.30, h: iconSize + 0.20,
    fill: { color: COLOR.panel }, line: { color: COLOR.grid, width: 0.5 },
    rectRadius: 0.08,
  });
  // re-add icon on top of panel
  try {
    slide.addImage({
      path: `${PNG}/eip-icons/${icon}.png`,
      x: iconX, y: iconY, w: iconSize, h: iconSize,
      sizing: { type: "contain", w: iconSize, h: iconSize },
    });
  } catch (e) { /* ok */ }
  const textX = iconX + iconSize + 0.60;
  const textW = 12.09 - textX + 0.62;
  // "The problem" label + text
  slide.addText("THE PROBLEM", {
    x: textX, y: 2.10, w: textW, h: 0.30,
    fontFace: FONT.title, fontSize: 11, bold: true, color: COLOR.red,
    charSpacing: 3, align: "left", valign: "middle",
  });
  slide.addText(problem, {
    x: textX, y: 2.45, w: textW, h: 1.30,
    fontFace: FONT.body, fontSize: 15, color: COLOR.body,
    align: "left", valign: "top", lineSpacingMultiple: 1.25,
  });
  // "The solution" label + text
  slide.addText("THE SOLUTION", {
    x: textX, y: 3.90, w: textW, h: 0.30,
    fontFace: FONT.title, fontSize: 11, bold: true, color: COLOR.platform,
    charSpacing: 3, align: "left", valign: "middle",
  });
  slide.addText(solution, {
    x: textX, y: 4.25, w: textW, h: 1.80,
    fontFace: FONT.body, fontSize: 15, color: COLOR.body,
    align: "left", valign: "top", lineSpacingMultiple: 1.25,
  });
}

// Side-by-side comparison (e.g., P2P vs Pub/Sub, Kafka vs Pulsar).
// `left` and `right` are {header, color, items[]} objects.
function addComparisonSlide(slide, eyebrow, title, left, right, opts = {}) {
  addContentTitle(slide, eyebrow, title);
  const y = opts.y ?? 1.95;
  const colW = opts.colW ?? 5.85;
  const gap = opts.gap ?? 0.40;
  const h = opts.h ?? 4.60;
  const leftX = 0.62;
  const rightX = leftX + colW + gap;

  [{ col: left, x: leftX }, { col: right, x: rightX }].forEach(({ col, x }) => {
    // accent bar
    slide.addShape("rect", {
      x, y, w: colW, h: 0.06,
      fill: { color: col.color || COLOR.red },
    });
    // header
    slide.addText(col.header, {
      x, y: y + 0.15, w: colW, h: 0.45,
      fontFace: FONT.title, fontSize: 20, bold: true, color: COLOR.ink,
      align: "left", valign: "middle",
    });
    // items
    const items = col.items.map((ln) => {
      if (typeof ln === "string") {
        return { text: ln, options: { bullet: { code: "25CF" }, paraSpaceAfter: 6, breakLine: true } };
      }
      return { text: ln.text, options: { bullet: { code: "25CF" }, paraSpaceAfter: 6, breakLine: true, ...(ln.options || {}) } };
    });
    slide.addText(items, {
      x, y: y + 0.65, w: colW, h: h - 0.65,
      fontFace: FONT.body, fontSize: 15, color: COLOR.body,
      align: "left", valign: "top", lineSpacingMultiple: 1.20,
    });
  });
}

// Icon grid: cards in a 2- or 3-column layout.
// `items` is an array of {icon, label, desc} objects.
function addIconGrid(slide, eyebrow, title, items, opts = {}) {
  addContentTitle(slide, eyebrow, title);
  const cols = opts.cols ?? (items.length <= 4 ? 2 : 3);
  const startY = opts.y ?? 2.00;
  const startX = 0.62;
  const totalW = 12.09;
  const gap = 0.30;
  const cellW = (totalW - gap * (cols - 1)) / cols;
  const cellH = opts.cellH ?? 2.10;
  const iconSize = opts.iconSize ?? 0.60;

  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cellW + gap);
    const y = startY + row * (cellH + 0.15);
    // card background
    slide.addShape("rect", {
      x, y, w: cellW, h: cellH,
      fill: { color: COLOR.panel },
      line: { color: COLOR.grid, width: 0.5 },
      rectRadius: 0.06,
    });
    // icon
    if (item.icon) {
      try {
        slide.addImage({
          path: `${PNG}/eip-icons/${item.icon}.png`,
          x: x + 0.20, y: y + 0.20, w: iconSize, h: iconSize,
          sizing: { type: "contain", w: iconSize, h: iconSize },
        });
      } catch (e) { /* ok */ }
    }
    // label
    slide.addText(item.label, {
      x: item.icon ? x + 0.20 + iconSize + 0.15 : x + 0.20,
      y: y + 0.18,
      w: cellW - 0.50 - (item.icon ? iconSize + 0.15 : 0),
      h: 0.38,
      fontFace: FONT.title, fontSize: 14, bold: true, color: COLOR.ink,
      align: "left", valign: "middle",
    });
    // description
    slide.addText(item.desc, {
      x: x + 0.20, y: y + 0.70, w: cellW - 0.40, h: cellH - 0.90,
      fontFace: FONT.body, fontSize: 12, color: COLOR.body,
      align: "left", valign: "top", lineSpacingMultiple: 1.20,
    });
  });
}

// Horizontal process flow: arrow-connected step boxes.
// `steps` is an array of {label, desc?} objects.
function addFlowSlide(slide, eyebrow, title, steps, opts = {}) {
  addContentTitle(slide, eyebrow, title);
  const y = opts.y ?? 2.80;
  const boxH = opts.boxH ?? 2.00;
  const totalW = 12.09;
  const startX = 0.62;
  const arrowW = 0.50;
  const n = steps.length;
  const boxW = (totalW - arrowW * (n - 1)) / n;

  steps.forEach((step, i) => {
    const x = startX + i * (boxW + arrowW);
    // step number circle
    slide.addShape("ellipse", {
      x: x + boxW / 2 - 0.18, y: y - 0.10, w: 0.36, h: 0.36,
      fill: { color: COLOR.red }, line: { color: COLOR.red, width: 0 },
    });
    slide.addText(String(i + 1), {
      x: x + boxW / 2 - 0.18, y: y - 0.10, w: 0.36, h: 0.36,
      fontFace: FONT.title, fontSize: 14, bold: true, color: COLOR.white,
      align: "center", valign: "middle",
    });
    // box
    slide.addShape("rect", {
      x, y: y + 0.40, w: boxW, h: boxH,
      fill: { color: COLOR.panel },
      line: { color: COLOR.grid, width: 0.5 },
      rectRadius: 0.06,
    });
    // label
    slide.addText(step.label, {
      x: x + 0.12, y: y + 0.50, w: boxW - 0.24, h: 0.50,
      fontFace: FONT.title, fontSize: 13, bold: true, color: COLOR.ink,
      align: "center", valign: "middle",
    });
    // description
    if (step.desc) {
      slide.addText(step.desc, {
        x: x + 0.12, y: y + 1.05, w: boxW - 0.24, h: boxH - 0.75,
        fontFace: FONT.body, fontSize: 11, color: COLOR.body,
        align: "center", valign: "top", lineSpacingMultiple: 1.15,
      });
    }
    // arrow between boxes
    if (i < n - 1) {
      const arrowX = x + boxW + 0.05;
      const arrowY = y + 0.40 + boxH / 2;
      slide.addShape("line", {
        x: arrowX, y: arrowY, w: arrowW - 0.10, h: 0,
        line: { color: COLOR.red, width: 2, endArrowType: "triangle" },
      });
    }
  });
}

// Key-value pairs in alternating-row layout.
// `pairs` is an array of {key, value} objects.
function addKeyValueSlide(slide, eyebrow, title, pairs, opts = {}) {
  addContentTitle(slide, eyebrow, title);
  const startY = opts.y ?? 1.95;
  const x = 0.62;
  const totalW = 12.09;
  const rowH = opts.rowH ?? 0.60;
  const keyW = opts.keyW ?? 3.80;

  pairs.forEach((pair, i) => {
    const y = startY + i * rowH;
    // alternating background
    if (i % 2 === 0) {
      slide.addShape("rect", {
        x, y, w: totalW, h: rowH,
        fill: { color: COLOR.panel },
      });
    }
    // key
    slide.addText(pair.key, {
      x: x + 0.20, y, w: keyW, h: rowH,
      fontFace: FONT.title, fontSize: 15, bold: true, color: COLOR.ink,
      align: "left", valign: "middle",
    });
    // value
    slide.addText(pair.value, {
      x: x + keyW + 0.40, y, w: totalW - keyW - 0.60, h: rowH,
      fontFace: FONT.body, fontSize: 14, color: COLOR.body,
      align: "left", valign: "middle",
    });
  });
}

module.exports = {
  PptxGenJS, COLOR, FONT, W, H, PNG, ASSETS,
  newDeck,
  addFooter, addContentTitle, addBullets, addTwoColBullets, addStatusTable,
  addCaption, addPerfCallout,
  addDiagramSlide, addCodeSlide, addLangChip, addSectionDivider, addNotes,
  addPatternCard, addComparisonSlide, addIconGrid, addFlowSlide, addKeyValueSlide,
};
