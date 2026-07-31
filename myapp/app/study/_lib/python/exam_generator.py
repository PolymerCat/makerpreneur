"""
exam_generator.py

Generates a print-ready PDF exam paper in the "SULIT" bilingual (English /
Bahasa Malaysia) format used by USM-style question papers, EXCLUDING the
cover page. Question content is supplied as a Python dict / JSON (this is
where your LLM-generated output plugs in) — this script only handles layout.

USAGE
-----
    python3 exam_generator.py questions.json output.pdf

or import and call build_pdf(data, "output.pdf") directly from your own
pipeline (e.g. straight after an LLM call that returns the same JSON shape).

INPUT JSON SCHEMA
------------------
{
  "paper": {
    "course_code": "CST434",           # shown top-right of every page
    "first_page_number": 2,             # optional, default 1. Set to 2 if you
                                         # want numbering to continue as if a
                                         # cover page (page 1) existed.
    "include_instructions": true,       # optional, default true
    "instructions": {                   # optional, only used if include_instructions
      "num_questions_en": "EIGHT (8)",
      "num_questions_bm": "LAPAN (8)"
    }
  },
  "questions": [
    {
      "number": 1,
      "text_en": "...",
      "text_bm": "...",
      "marks": 7,
      "image": null                     # optional path to a diagram image
    },
    {
      "number": 3,
      "marks": 18,
      "intro_en": "Answer the following questions.",   # optional
      "intro_bm": "Jawab soalan-soalan yang berikut.",  # optional
      "parts": [
        {"label": "a", "text_en": "...", "text_bm": "...", "image": null},
        {"label": "b", "text_en": "...", "text_bm": "...", "image": "diagram.png"}
      ]
    }
  ]
}

Only "number", "text_en"/"parts", and "marks" are required per question.
Everything else is optional.
"""

import io
import json
import re
import sys

def format_math_text(text):
    if not text or not isinstance(text, str):
        return text
    replacements = {
        r'\alpha': 'α', r'\beta': 'β', r'\gamma': 'γ', r'\delta': 'δ',
        r'\theta': 'θ', r'\lambda': 'λ', r'\mu': 'μ', r'\pi': 'π',
        r'\sigma': 'σ', r'\omega': 'ω', r'\Delta': 'Δ', r'\Sigma': 'Σ',
        r'\Omega': 'Ω', r'\infty': '∞', r'\approx': '≈', r'\neq': '≠',
        r'\leq': '≤', r'\geq': '≥', r'\pm': '±', r'\times': '×',
        r'\cdot': '·', r'\div': '÷', r'\rightarrow': '→', r'\leftarrow': '←',
        r'\le': '≤', r'\ge': '≥', r'\ne': '≠', r'\sum': '∑',
        r'\prod': '∏', r'\int': '∫', r'\sim': '~', r'\equiv': '≡',
        r'\partial': '∂', r'\nabla': '∇', r'\mp': '∓', r'\Rightarrow': '⇒',
        r'\Leftarrow': '⇐', r'\leftrightarrow': '↔', r'\Leftrightarrow': '⇔'
    }
    for k, v in replacements.items():
        text = text.replace(k, v)

    text = re.sub(r'\\sqrt\{([^}]+)\}', r'√(\g<1>)', text)
    text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'(\g<1>)/(\g<2>)', text)
    text = re.sub(r'_\{([^}]+)\}', r'<sub>\g<1></sub>', text)
    text = re.sub(r'_([a-zA-Z0-9])', r'<sub>\g<1></sub>', text)
    text = re.sub(r'\^\{([^}]+)\}', r'<sup>\g<1></sup>', text)
    text = re.sub(r'\^([a-zA-Z0-9])', r'<sup>\g<1></sup>', text)

    text = re.sub(r'\$\$(.*?)\$\$', r'\g<1>', text)
    text = re.sub(r'\$(.*?)\$', r'\g<1>', text)
    text = re.sub(r'\\\((.*?)\\\)', r'\g<1>', text)
    text = re.sub(r'\\\[(.*?)\\\]', r'\g<1>', text)

    text = re.sub(r'&(?!(?:amp|lt|gt|nbsp|quot|apos|#\d+);)', '&amp;', text)

    # Protect valid ReportLab tags by temporarily replacing them with placeholders
    valid_tags_pattern = r'<(/?(?:b|i|u|sub|sup|font)(?:\s+[^>]*)?)>'
    protected = []
    def protect_tag(match):
        protected.append(match.group(0))
        return f'@@TAG_{len(protected)-1}@@'
    text = re.sub(valid_tags_pattern, protect_tag, text, flags=re.IGNORECASE)

    # Replace any remaining '<' or '>' (e.g. in math inequalities x < y or a > b)
    text = text.replace('<', '&lt;').replace('>', '&gt;')

    # Restore protected ReportLab tags
    for idx, tag in enumerate(protected):
        text = text.replace(f'@@TAG_{idx}@@', tag)

    return text

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, KeepTogether, PageBreak,
)
from reportlab.lib.utils import ImageReader

# ---------------------------------------------------------------------------
# Layout constants (tweak here to adjust the whole document)
# ---------------------------------------------------------------------------
PAGE_SIZE = A4
PAGE_W, PAGE_H = PAGE_SIZE

MARGIN_LR = 25 * mm
TOP_MARGIN = 34 * mm       # extra room reserved for the header block
BOTTOM_MARGIN = 32 * mm    # extra room reserved for the footer block

HEADER_LINE1_Y = PAGE_H - 16 * mm   # "SULIT" ... course code
HEADER_LINE2_Y = PAGE_H - 23 * mm   # "- N -"

FOOTER_LINE1_Y = 20 * mm            # "...N/-"  or  "- oooOooo -"
FOOTER_LINE2_Y = 12 * mm            # "SULIT" mark

FONT_MAIN = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_ITALIC = "Helvetica-Oblique"

MAX_IMAGE_WIDTH = PAGE_W - 2 * MARGIN_LR
MAX_IMAGE_HEIGHT = 80 * mm


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
def make_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="QCenterBold", fontName=FONT_BOLD, fontSize=11,
        alignment=1, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="Instructions", fontName=FONT_MAIN, fontSize=10.5,
        leading=14, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="InstructionsBM", fontName=FONT_ITALIC, fontSize=10.5,
        leading=14, spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        name="QuestionEN", fontName=FONT_MAIN, fontSize=11, leading=15,
        leftIndent=18, firstLineIndent=-18, spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        name="QuestionBM", fontName=FONT_ITALIC, fontSize=11, leading=15,
        leftIndent=18, firstLineIndent=0, spaceAfter=14,
    ))
    styles.add(ParagraphStyle(
        name="PartEN", fontName=FONT_MAIN, fontSize=11, leading=15,
        leftIndent=36, firstLineIndent=-18, spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        name="PartBM", fontName=FONT_ITALIC, fontSize=11, leading=15,
        leftIndent=36, firstLineIndent=0, spaceAfter=14,
    ))
    styles.add(ParagraphStyle(
        name="Marks", fontName=FONT_MAIN, fontSize=11, alignment=TA_RIGHT,
        spaceBefore=2, spaceAfter=16,
    ))
    return styles


# ---------------------------------------------------------------------------
# Story (flowable) construction
# ---------------------------------------------------------------------------
def _scaled_image(path):
    """Return an Image flowable scaled to fit within the page/column width."""
    ir = ImageReader(path)
    iw, ih = ir.getSize()
    scale = min(MAX_IMAGE_WIDTH / iw, MAX_IMAGE_HEIGHT / ih, 1.0)
    img = Image(path, width=iw * scale, height=ih * scale)
    img.hAlign = "CENTER"
    return img


def _instructions_block(paper_cfg, styles):
    instr = paper_cfg.get("instructions", {})
    num_en = instr.get("num_questions_en", "EIGHT (8)")
    num_bm = instr.get("num_questions_bm", "LAPAN (8)")

    flow = []
    flow.append(Paragraph(
        f"<b>Instructions</b>: Answer <b>{num_en}</b> questions.",
        styles["Instructions"]))
    flow.append(Paragraph(
        f"[<i><b>Arahan</b>: Jawab <b>{num_bm}</b> soalan.]</i>",
        styles["InstructionsBM"]))
    flow.append(Paragraph(
        "You may answer the questions either in English or in Bahasa Malaysia.",
        styles["Instructions"]))
    flow.append(Paragraph(
        "<i>Anda dibenarkan menjawab soalan sama ada dalam bahasa Inggeris "
        "atau bahasa Malaysia.</i>",
        styles["InstructionsBM"]))
    flow.append(Paragraph(
        "In the event of any discrepancies, the English version shall be used.",
        styles["Instructions"]))
    flow.append(Paragraph(
        "<i>Sekiranya terdapat sebarang percanggahan pada soalan peperiksaan, "
        "versi bahasa Inggeris hendaklah diguna pakai.</i>",
        styles["InstructionsBM"]))
    flow.append(Spacer(1, 10 * mm))
    return flow


def _question_block(q, styles):
    """Build the flowables for a single question (with or without parts)."""
    number = q["number"]
    block = []

    # Top-level question text (may be absent if the question is only an
    # intro followed by lettered parts, e.g. "Answer the following questions.")
    if q.get("text_en"):
        t_en = format_math_text(q['text_en'])
        pair = [Paragraph(f"{number}.&nbsp;&nbsp;{t_en}", styles["QuestionEN"])]
        if q.get("text_bm"):
            t_bm = format_math_text(q['text_bm'])
            pair.append(Paragraph(f"<i>{t_bm}</i>", styles["QuestionBM"]))
        block.append(KeepTogether(pair))
        if q.get("image"):
            block.append(_scaled_image(q["image"]))
            block.append(Spacer(1, 4 * mm))

    elif q.get("intro_en"):
        i_en = format_math_text(q['intro_en'])
        pair = [Paragraph(f"{number}.&nbsp;&nbsp;{i_en}", styles["QuestionEN"])]
        if q.get("intro_bm"):
            i_bm = format_math_text(q['intro_bm'])
            pair.append(Paragraph(f"<i>{i_bm}</i>", styles["QuestionBM"]))
        block.append(KeepTogether(pair))

    # Lettered sub-parts, e.g. (a) (b) (c)
    for part in q.get("parts", []):
        label = part["label"]
        p_en = format_math_text(part['text_en'])
        pair = [Paragraph(f"({label})&nbsp;&nbsp;{p_en}", styles["PartEN"])]
        if part.get("text_bm"):
            p_bm = format_math_text(part['text_bm'])
            pair.append(Paragraph(f"<i>{p_bm}</i>", styles["PartBM"]))
        block.append(KeepTogether(pair))
        if part.get("image"):
            block.append(_scaled_image(part["image"]))
            block.append(Spacer(1, 4 * mm))

    # Marks, shown once per question (after the last part if there are parts)
    if q.get("marks") is not None:
        block.append(Paragraph(f"({q['marks']}/100)", styles["Marks"]))

    if q.get("page_break_before"):
        return [PageBreak()] + block
    return block


def build_story(data, styles):
    story = []
    paper_cfg = data.get("paper", {})
    if paper_cfg.get("include_instructions", True):
        story.extend(_instructions_block(paper_cfg, styles))

    for q in data["questions"]:
        story.extend(_question_block(q, styles))

    return story


# ---------------------------------------------------------------------------
# Header / footer
# ---------------------------------------------------------------------------
def _underline(c, text, x, y, font, size):
    w = c.stringWidth(text, font, size)
    c.line(x, y - 1.5, x + w, y - 1.5)


def _draw_header_footer(c, doc, course_code, total_pages, first_page_number):
    page_num = c.getPageNumber() + (first_page_number - 1)
    last_page_num = total_pages + (first_page_number - 1)

    c.saveState()

    # --- Header ---
    c.setFont(FONT_BOLD, 11)
    c.drawString(MARGIN_LR, HEADER_LINE1_Y, "SULIT")
    _underline(c, "SULIT", MARGIN_LR, HEADER_LINE1_Y, FONT_BOLD, 11)

    c.setFont(FONT_MAIN, 11)
    c.drawRightString(PAGE_W - MARGIN_LR, HEADER_LINE1_Y, course_code)
    c.drawCentredString(PAGE_W / 2, HEADER_LINE2_Y, f"- {page_num} -")

    # --- Footer ---
    if page_num < last_page_num:
        c.setFont(FONT_MAIN, 10)
        c.drawRightString(PAGE_W - MARGIN_LR, FOOTER_LINE1_Y, f"...{page_num + 1}/-")
    else:
        c.setFont(FONT_MAIN, 11)
        c.drawCentredString(PAGE_W / 2, FOOTER_LINE1_Y, "- oooOooo -")

    c.setFont(FONT_BOLD, 11)
    c.drawCentredString(PAGE_W / 2, FOOTER_LINE2_Y, "SULIT")
    sw = c.stringWidth("SULIT", FONT_BOLD, 11)
    c.line(PAGE_W / 2 - sw / 2, FOOTER_LINE2_Y - 1.5, PAGE_W / 2 + sw / 2, FOOTER_LINE2_Y - 1.5)

    c.restoreState()


# ---------------------------------------------------------------------------
# Two-pass build: first pass counts pages, second pass renders with the
# correct total (needed so the last page gets "- oooOooo -" instead of a
# "...N/-" pointer, and so every page's "-N-" number is correct).
# ---------------------------------------------------------------------------
def _count_pages(story_factory):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=PAGE_SIZE,
        leftMargin=MARGIN_LR, rightMargin=MARGIN_LR,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
    )
    counter = {"pages": 0}

    def on_page(c, d):
        counter["pages"] = c.getPageNumber()

    doc.build(story_factory(), onFirstPage=on_page, onLaterPages=on_page)
    return counter["pages"]


def build_pdf(data, output_path):
    styles = make_styles()
    paper_cfg = data.get("paper", {})
    course_code = paper_cfg.get("course_code", "")
    first_page_number = paper_cfg.get("first_page_number", 1)

    # story_factory() must produce a *fresh* list each call — flowables are
    # stateful once built into a document.
    story_factory = lambda: build_story(data, styles)

    total_pages = _count_pages(story_factory)

    doc = SimpleDocTemplate(
        output_path, pagesize=PAGE_SIZE,
        leftMargin=MARGIN_LR, rightMargin=MARGIN_LR,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
    )

    def on_page(c, d):
        _draw_header_footer(c, d, course_code, total_pages, first_page_number)

    doc.build(story_factory(), onFirstPage=on_page, onLaterPages=on_page)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 exam_generator.py questions.json output.pdf")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        data = json.load(f)

    build_pdf(data, sys.argv[2])
    print(f"Wrote {sys.argv[2]}")
