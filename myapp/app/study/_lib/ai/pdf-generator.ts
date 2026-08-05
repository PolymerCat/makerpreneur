/**
 * pdf-generator.ts
 *
 * Node.js port of the old exam_generator.py (reportlab). Generates a
 * print-ready PDF exam paper in the "SULIT" bilingual (English / Bahasa
 * Malaysia) format used by USM-style question papers, excluding the cover
 * page. Runs on Vercel serverless (pure JS, no native deps).
 *
 * Input JSON shape (same as the old Python script):
 * {
 *   "paper": {
 *     "course_code": "CST434",
 *     "first_page_number": 2,       // optional, default 1
 *     "include_instructions": true, // optional, default true
 *     "instructions": {
 *       "num_questions_en": "EIGHT (8)",
 *       "num_questions_bm": "LAPAN (8)"
 *     }
 *   },
 *   "questions": [
 *     { "number": 1, "text_en": "...", "text_bm": "...", "marks": 7, "image": null },
 *     { "number": 3, "marks": 18, "intro_en": "...", "intro_bm": "...",
 *       "parts": [ {"label": "a", "text_en": "...", "text_bm": "...", "image": null} ] }
 *   ]
 * }
 */

import PDFDocument from "pdfkit"
import fs from "fs"

// Layout constants (points; 1mm = 2.8346pt). Tuned to match the reportlab version.
var PAGE_W = 595.28
var PAGE_H = 841.89
var MARGIN_LR = 70.87 // 25mm
var CONTENT_TOP = 96.38 // 34mm
var CONTENT_BOTTOM = 751.18 // PAGE_H - 32mm
var HEADER_Y1 = 45.35 // 16mm from top
var HEADER_Y2 = 65.2 // 23mm from top
var FOOTER_Y1 = 785.2 // PAGE_H - 20mm
var FOOTER_Y2 = 807.87 // PAGE_H - 12mm
var MAX_IMAGE_WIDTH = 453.54 // PAGE_W - 2 * MARGIN_LR
var MAX_IMAGE_HEIGHT = 226.77 // 80mm

var FONT_MAIN = "Helvetica"
var FONT_BOLD = "Helvetica-Bold"
var FONT_ITALIC = "Helvetica-Oblique"
var FONT_BOLD_ITALIC = "Helvetica-BoldOblique"
var ASC_RATIO = 0.718 // Helvetica ascender / 1000 (baseline offset below text top)

var SPACER_AFTER_INSTRUCTIONS = 28.35 // 10mm
var SPACER_AFTER_IMAGE = 11.34 // 4mm

// ---------------------------------------------------------------------------
// Math text preprocessing (direct port of format_math_text from exam_generator.py)
// ---------------------------------------------------------------------------
function formatMathText(text: any): any {
  if (!text || typeof text !== "string") return text
  var replacements: any = {
    "\\alpha": "\u03B1", "\\beta": "\u03B2", "\\gamma": "\u03B3", "\\delta": "\u03B4",
    "\\theta": "\u03B8", "\\lambda": "\u03BB", "\\mu": "\u03BC", "\\pi": "\u03C0",
    "\\sigma": "\u03C3", "\\omega": "\u03C9", "\\Delta": "\u0394", "\\Sigma": "\u03A3",
    "\\Omega": "\u03A9", "\\infty": "\u221E", "\\approx": "\u2248", "\\neq": "\u2260",
    "\\leq": "\u2264", "\\geq": "\u2265", "\\pm": "\u00B1", "\\times": "\u00D7",
    "\\cdot": "\u00B7", "\\div": "\u00F7", "\\rightarrow": "\u2192", "\\leftarrow": "\u2190",
    "\\le": "\u2264", "\\ge": "\u2265", "\\ne": "\u2260", "\\sum": "\u2211",
    "\\prod": "\u220F", "\\int": "\u222B", "\\sim": "~", "\\equiv": "\u2261",
    "\\partial": "\u2202", "\\nabla": "\u2207", "\\mp": "\u2213", "\\Rightarrow": "\u21D2",
    "\\Leftarrow": "\u21D0", "\\leftrightarrow": "\u2194", "\\Leftrightarrow": "\u21D4",
  }
  for (var k in replacements) {
    text = text.split(k).join(replacements[k])
  }
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "\u221A($1)")
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
  text = text.replace(/_\{([^}]+)\}/g, "<sub>$1</sub>")
  text = text.replace(/_([a-zA-Z0-9])/g, "<sub>$1</sub>")
  text = text.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>")
  text = text.replace(/\^([a-zA-Z0-9])/g, "<sup>$1</sup>")
  text = text.replace(/\$\$(.*?)\$\$/g, "$1")
  text = text.replace(/\$(.*?)\$/g, "$1")
  text = text.replace(/\\\((.*?)\\\)/g, "$1")
  text = text.replace(/\\\[(.*?)\\\]/g, "$1")
  text = text.replace(/&(?!(?:amp|lt|gt|nbsp|quot|apos|#\d+);)/g, "&amp;")

  // Protect valid ReportLab-style tags, then escape remaining < >.
  var validTags = /<(\/?(?:b|i|u|sub|sup|font)(?:\s+[^>]*)?)>/gi
  var protectedTags: string[] = []
  text = text.replace(validTags, function(match: string) {
    protectedTags.push(match)
    return "@@TAG_" + (protectedTags.length - 1) + "@@"
  })
  text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  for (var i = 0; i < protectedTags.length; i++) {
    text = text.replace("@@TAG_" + i + "@@", protectedTags[i])
  }
  return text
}

// ---------------------------------------------------------------------------
// Inline markup handling (pdfkit v3 renders tags literally, so we split text
// into styled segments ourselves)
// ---------------------------------------------------------------------------
interface Seg {
  text: string
  b: boolean
  i: boolean
  u: boolean
  sub: boolean
  sup: boolean
}

function parseMarkup(text: string): Seg[] {
  var segs: Seg[] = []
  var cur: Seg = { text: "", b: false, i: false, u: false, sub: false, sup: false }
  function flush() {
    if (cur.text) {
      segs.push(cur)
      cur = { text: "", b: cur.b, i: cur.i, u: cur.u, sub: cur.sub, sup: cur.sup }
    }
  }
  var re = /<(\/?(?:b|i|u|sub|sup|font)(?:\s+[^>]*)?)>/gi
  var last = 0
  var m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    var tag = m[1].toLowerCase()
    var close = tag.charAt(0) === "/"
    var name = close ? tag.slice(1) : tag
    cur.text += text.slice(last, m.index)
    if (close) {
      flush()
      if (name !== "font") (cur as any)[name] = false
    } else {
      flush()
      if (name !== "font") (cur as any)[name] = true
    }
    last = m.index + m[0].length
  }
  cur.text += text.slice(last)
  if (cur.text) segs.push(cur)
  return segs
}

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|nbsp|quot|apos|#\d+);/g, function(m: string, e: string) {
    if (e === "amp") return "&"
    if (e === "lt") return "<"
    if (e === "gt") return ">"
    if (e === "nbsp") return "\u00A0"
    if (e === "quot") return '"'
    if (e === "apos") return "'"
    if (e.charAt(0) === "#") return String.fromCharCode(parseInt(e.slice(1), 10))
    return m
  })
}

// Split into words; only plain spaces break lines, so tags and \u00A0 stay
// glued to their word (mimics &nbsp; semantics of the reportlab version).
function splitWords(text: string): string[] {
  var words: string[] = []
  var current = ""
  var inTag = false
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i)
    if (ch === "<") {
      inTag = true
      current += ch
    } else if (ch === ">") {
      inTag = false
      current += ch
    } else if ((ch === " " || ch === "\t" || ch === "\r" || ch === "\n") && !inTag) {
      if (current) {
        words.push(current)
        current = ""
      }
    } else {
      current += ch
    }
  }
  if (current) words.push(current)
  return words
}

function segmentFont(s: Seg, baseFont: string): string {
  if (s.b) return s.i ? FONT_BOLD_ITALIC : FONT_BOLD
  if (s.i) return FONT_ITALIC
  return baseFont
}

function segmentSize(size: number, s: Seg): number {
  return s.sub || s.sup ? size * 0.7 : size
}

// Measure one line (tags stripped, entities decoded; nbsp counted as space).
function lineWidth(doc: any, line: string, size: number, baseFont: string): number {
  var segs = parseMarkup(line)
  var w = 0
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i]
    doc.font(segmentFont(s, baseFont)).fontSize(segmentSize(size, s))
    w += doc.widthOfString(decodeEntities(s.text).replace(/[\u00A0\u0001]/g, " "))
  }
  return w
}

function wrapMarkup(doc: any, text: string, maxWidth: number, size: number, baseFont: string): string[] {
  // Protect raw nbsp from line breaking; restored to a space at draw time.
  var text2 = text.replace(/\u00A0/g, "\u0001")
  var words = splitWords(text2)
  var lines: string[] = []
  var cur: string[] = []
  for (var i = 0; i < words.length; i++) {
    var test = cur.length ? cur.concat([words[i]]).join(" ") : words[i]
    if (cur.length === 0 || lineWidth(doc, test, size, baseFont) <= maxWidth) {
      cur.push(words[i])
    } else {
      lines.push(cur.join(" "))
      cur = [words[i]]
    }
  }
  if (cur.length) lines.push(cur.join(" "))
  return lines
}

// Draw one already-wrapped line at the given baseline; returns next x.
function drawLine(doc: any, line: string, x: number, baselineY: number, size: number, baseFont: string): number {
  var segs = parseMarkup(line)
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i]
    var eff = segmentSize(size, s)
    var dy = s.sub ? 0.18 * size : s.sup ? -0.32 * size : 0
    var t = decodeEntities(s.text).replace(/\u0001/g, " ")
    if (!t) continue
    doc.font(segmentFont(s, baseFont)).fontSize(eff)
    doc.text(t, x, baselineY + dy, { lineBreak: false, baseline: "alphabetic" })
    var w = doc.widthOfString(t)
    if (s.u) {
      doc.save().lineWidth(1).moveTo(x, baselineY + 1.2).lineTo(x + w, baselineY + 1.2).stroke().restore()
    }
    x += w
  }
  return x
}

// Draw wrapped lines; page-breaks inside the paragraph. Returns y after the block.
function drawLines(doc: any, lines: string[], firstX: number, wrappedX: number, y: number, size: number, baseFont: string, leading: number): number {
  for (var i = 0; i < lines.length; i++) {
    if (y + leading > CONTENT_BOTTOM) {
      doc.addPage()
      y = CONTENT_TOP
    }
    drawLine(doc, lines[i], i === 0 ? firstX : wrappedX, y + ASC_RATIO * size, size, baseFont)
    y += leading
  }
  return y
}

interface ParagraphOpts {
  size: number
  leading: number
  indent: number
  firstIndent?: number
  spaceAfter: number
  fontName: string
}

function placeParagraph(doc: any, text: string, y: number, opts: ParagraphOpts): number {
  var maxW = PAGE_W - 2 * MARGIN_LR - opts.indent
  var lines = wrapMarkup(doc, text, maxW, opts.size, opts.fontName)
  var firstX = MARGIN_LR + (opts.firstIndent != null ? opts.firstIndent : opts.indent)
  var wrappedX = MARGIN_LR + opts.indent
  var y2 = drawLines(doc, lines, firstX, wrappedX, y, opts.size, opts.fontName, opts.leading)
  return y2 + opts.spaceAfter
}

// Question number + EN/BM text pair, kept together on one page (KeepTogether).
function placeQuestionPair(doc: any, number: any, textEn: string, textBm: any, y: number): number {
  var prefix = number + ".\u00A0\u00A0"
  var enLines = wrapMarkup(doc, prefix + textEn, PAGE_W - 2 * MARGIN_LR - 18, 11, FONT_MAIN)
  var bmLines = textBm ? wrapMarkup(doc, textBm, PAGE_W - 2 * MARGIN_LR - 18, 11, FONT_ITALIC) : []
  var pairH = enLines.length * 15 + 3 + (textBm ? bmLines.length * 15 + 14 : 0)
  if (y + pairH > CONTENT_BOTTOM) {
    doc.addPage()
    y = CONTENT_TOP
  }
  var y2 = drawLines(doc, enLines, MARGIN_LR, MARGIN_LR + 18, y, 11, FONT_MAIN, 15) + 3
  if (textBm) {
    y2 = drawLines(doc, bmLines, MARGIN_LR + 18, MARGIN_LR + 18, y2, 11, FONT_ITALIC, 15) + 14
  }
  return y2
}

function placeImage(doc: any, imgPath: string, y: number): number {
  if (!imgPath || !fs.existsSync(imgPath)) return y
  var info: any
  try {
    info = (doc as any).openImage(imgPath)
  } catch (e) {
    return y
  }
  var iw = info.width
  var ih = info.height
  var scale = Math.min(MAX_IMAGE_WIDTH / iw, MAX_IMAGE_HEIGHT / ih, 1)
  var w = iw * scale
  var h = ih * scale
  if (y + h + SPACER_AFTER_IMAGE > CONTENT_BOTTOM) {
    doc.addPage()
    y = CONTENT_TOP
  }
  doc.image(imgPath, (PAGE_W - w) / 2, y, { width: w, height: h })
  return y + h + SPACER_AFTER_IMAGE
}

function placeInstructions(doc: any, paperCfg: any, y: number): number {
  var instr = paperCfg.instructions || {}
  var numEn = instr.num_questions_en || "EIGHT (8)"
  var numBm = instr.num_questions_bm || "LAPAN (8)"
  y = placeParagraph(doc, "<b>Instructions</b>: Answer <b>" + numEn + "</b> questions.", y, { size: 10.5, leading: 14, indent: 0, spaceAfter: 6, fontName: FONT_MAIN })
  y = placeParagraph(doc, "[<i><b>Arahan</b>: Jawab <b>" + numBm + "</b> soalan.]</i>", y, { size: 10.5, leading: 14, indent: 0, spaceAfter: 10, fontName: FONT_ITALIC })
  y = placeParagraph(doc, "You may answer the questions either in English or in Bahasa Malaysia.", y, { size: 10.5, leading: 14, indent: 0, spaceAfter: 6, fontName: FONT_MAIN })
  y = placeParagraph(doc, "<i>Anda dibenarkan menjawab soalan sama ada dalam bahasa Inggeris atau bahasa Malaysia.</i>", y, { size: 10.5, leading: 14, indent: 0, spaceAfter: 10, fontName: FONT_ITALIC })
  y = placeParagraph(doc, "In the event of any discrepancies, the English version shall be used.", y, { size: 10.5, leading: 14, indent: 0, spaceAfter: 6, fontName: FONT_MAIN })
  y = placeParagraph(doc, "<i>Sekiranya terdapat sebarang percanggahan pada soalan peperiksaan, versi bahasa Inggeris hendaklah diguna pakai.</i>", y, { size: 10.5, leading: 14, indent: 0, spaceAfter: 10, fontName: FONT_ITALIC })
  return y + SPACER_AFTER_INSTRUCTIONS
}

function placeQuestion(doc: any, index: number, q: any, y: number): number {
  var number = q.number != null ? q.number : index + 1
  if (q.text_en) {
    y = placeQuestionPair(doc, number, formatMathText(q.text_en) || "", q.text_bm ? formatMathText(q.text_bm) : null, y)
    if (q.image) y = placeImage(doc, q.image, y)
  } else if (q.intro_en) {
    y = placeQuestionPair(doc, number, formatMathText(q.intro_en) || "", q.intro_bm ? formatMathText(q.intro_bm) : null, y)
  }

  var parts = q.parts || []
  for (var j = 0; j < parts.length; j++) {
    var part = parts[j]
    if (!part || !part.text_en) continue
    y = placeParagraph(doc, "(" + part.label + ")\u00A0\u00A0" + formatMathText(part.text_en), y, { size: 11, leading: 15, indent: 36, firstIndent: 18, spaceAfter: 3, fontName: FONT_MAIN })
    if (part.text_bm) {
      y = placeParagraph(doc, formatMathText(part.text_bm), y, { size: 11, leading: 15, indent: 36, spaceAfter: 14, fontName: FONT_ITALIC })
    }
    if (part.image) y = placeImage(doc, part.image, y)
  }

  if (q.marks != null) {
    var marksText = "(" + q.marks + "/100)"
    var marksH = 13.2
    if (y + 2 + marksH + 16 > CONTENT_BOTTOM) {
      doc.addPage()
      y = CONTENT_TOP
    }
    y += 2
    doc.font(FONT_MAIN).fontSize(11)
    doc.text(marksText, PAGE_W - MARGIN_LR - doc.widthOfString(marksText), y + ASC_RATIO * 11, { lineBreak: false, baseline: "alphabetic" })
    y += marksH + 16
  }
  return y
}

function drawHeaderFooter(doc: any, courseCode: string, pageNum: number, lastPageNum: number): void {
  var xRight = PAGE_W - MARGIN_LR
  doc.font(FONT_BOLD).fontSize(11)
  var sulitW = doc.widthOfString("SULIT")
  doc.text("SULIT", MARGIN_LR, HEADER_Y1, { lineBreak: false, baseline: "alphabetic" })
  doc.save().lineWidth(1).moveTo(MARGIN_LR, HEADER_Y1 + 1.5).lineTo(MARGIN_LR + sulitW, HEADER_Y1 + 1.5).stroke().restore()

  doc.font(FONT_MAIN).fontSize(11)
  doc.text(courseCode, xRight - doc.widthOfString(courseCode), HEADER_Y1, { lineBreak: false, baseline: "alphabetic" })
  var pageTag = "- " + pageNum + " -"
  doc.text(pageTag, (PAGE_W - doc.widthOfString(pageTag)) / 2, HEADER_Y2, { lineBreak: false, baseline: "alphabetic" })

  if (pageNum < lastPageNum) {
    doc.font(FONT_MAIN).fontSize(10)
    var cont = "..." + (pageNum + 1) + "/-"
    doc.text(cont, xRight - doc.widthOfString(cont), FOOTER_Y1, { lineBreak: false, baseline: "alphabetic" })
  } else {
    doc.font(FONT_MAIN).fontSize(11)
    var fin = "- oooOooo -"
    doc.text(fin, (PAGE_W - doc.widthOfString(fin)) / 2, FOOTER_Y1, { lineBreak: false, baseline: "alphabetic" })
  }

  doc.font(FONT_BOLD).fontSize(11)
  doc.text("SULIT", (PAGE_W - sulitW) / 2, FOOTER_Y2, { lineBreak: false, baseline: "alphabetic" })
  doc.save().lineWidth(1).moveTo((PAGE_W - sulitW) / 2, FOOTER_Y2 + 1.5).lineTo((PAGE_W - sulitW) / 2 + sulitW, FOOTER_Y2 + 1.5).stroke().restore()
}

export function generateExamPdf(jsonObj: any): Promise<Buffer> {
  return new Promise(function(resolve, reject) {
    try {
      var doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, bufferPages: true })
      var paperCfg = jsonObj.paper || {}
      var y = CONTENT_TOP

      if (paperCfg.include_instructions !== false) {
        y = placeInstructions(doc, paperCfg, y)
      }

      var questions = jsonObj.questions || []
      for (var i = 0; i < questions.length; i++) {
        var q = questions[i]
        if (q && q.page_break_before) {
          doc.addPage()
          y = CONTENT_TOP
        }
        if (q) y = placeQuestion(doc, i, q, y)
      }

      // Second pass: headers/footers need the total page count (last page
      // gets "- oooOooo -" instead of a "...N/-" pointer).
      var range = doc.bufferedPageRange()
      var totalPages = range.count
      var firstPageNumber = paperCfg.first_page_number != null ? paperCfg.first_page_number : 1
      var lastPageNum = totalPages + (firstPageNumber - 1)
      for (var p = 0; p < totalPages; p++) {
        doc.switchToPage(p)
        drawHeaderFooter(doc, paperCfg.course_code || "", p + 1 + (firstPageNumber - 1), lastPageNum)
      }

      var chunks: Buffer[] = []
      doc.on("data", function(c: any) {
        chunks.push(c as Buffer)
      })
      doc.on("end", function() {
        resolve(Buffer.concat(chunks))
      })
      doc.on("error", reject)
      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}
