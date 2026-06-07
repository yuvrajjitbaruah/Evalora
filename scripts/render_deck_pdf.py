from __future__ import annotations

import json
import math
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "evalora_approach.pdf"
LOGO = ROOT / "public" / "assets" / "evalora-logo-transparent.png"
REPORT = ROOT / "public" / "data" / "score_report.json"
SUBMISSION = ROOT / "outputs" / "evalora_submission.csv"

W, H = landscape((960, 540))
INK = colors.HexColor("#111722")
MUTED = colors.HexColor("#657185")
LINE = colors.HexColor("#d9e1ea")
BG = colors.HexColor("#f6f8fb")
SURFACE = colors.white
RAIL = colors.HexColor("#111722")
ACCENT = colors.HexColor("#02a9c7")
VIOLET = colors.HexColor("#6653f2")
AMBER = colors.HexColor("#f2b84b")


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    report = load_report()
    top_rows = load_submission_rows()

    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    draw_cover(c, report)
    draw_jd(c)
    draw_architecture(c)
    draw_scoring(c)
    draw_trust(c)
    draw_output(c, report, top_rows)
    draw_package(c)
    c.save()
    print(f"Deck PDF written to {OUT}")


def load_report() -> dict:
    if REPORT.exists():
        return json.loads(REPORT.read_text(encoding="utf-8"))
    return {
        "input": {"candidates_scored": 100000, "elapsed_ms": 24000},
        "shortlist": {"max_score": 0.88, "min_score": 0.74},
    }


def load_submission_rows() -> list[list[str]]:
    if not SUBMISSION.exists():
        return []
    lines = SUBMISSION.read_text(encoding="utf-8").splitlines()[1:4]
    rows = []
    for line in lines:
        rows.append(parse_csv_line(line))
    return rows


def parse_csv_line(line: str) -> list[str]:
    cells, cell, quoted = [], "", False
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == '"':
            if quoted and i + 1 < len(line) and line[i + 1] == '"':
                cell += '"'
                i += 1
            else:
                quoted = not quoted
        elif ch == "," and not quoted:
            cells.append(cell)
            cell = ""
        else:
            cell += ch
        i += 1
    cells.append(cell)
    return cells


def slide(c: canvas.Canvas, dark: bool = False) -> None:
    c.setFillColor(RAIL if dark else BG)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    if dark:
        c.setFillColor(colors.Color(0.02, 0.66, 0.78, alpha=0.18))
        c.circle(170, 440, 160, stroke=0, fill=1)
        c.setFillColor(colors.Color(0.95, 0.72, 0.29, alpha=0.16))
        c.circle(850, 70, 170, stroke=0, fill=1)


def kicker(c: canvas.Canvas, text: str, x: float, y: float, dark: bool = False) -> None:
    c.setFillColor(ACCENT if dark else VIOLET)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x, y, text.upper())


def heading(c: canvas.Canvas, text: str, x: float, y: float, size: int = 32, dark: bool = False, width: float = 650) -> float:
    c.setFillColor(colors.white if dark else INK)
    c.setFont("Helvetica-Bold", size)
    return paragraph(c, text, x, y, width, size * 1.05, font="Helvetica-Bold", size=size)


def paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    leading: float,
    font: str = "Helvetica",
    size: int = 12,
    color=INK,
) -> float:
    c.setFillColor(color)
    c.setFont(font, size)
    words = text.split()
    line = ""
    for word in words:
        probe = f"{line} {word}".strip()
        if c.stringWidth(probe, font, size) <= width:
            line = probe
        else:
            c.drawString(x, y, line)
            y -= leading
            line = word
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def box(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, body: str, accent=ACCENT) -> None:
    c.setFillColor(SURFACE)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 6, stroke=1, fill=1)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 6, w, 6, 3, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x + 16, y + h - 30, title)
    paragraph(c, body, x + 16, y + h - 52, w - 32, 15, size=10.5, color=MUTED)


def draw_cover(c: canvas.Canvas, report: dict) -> None:
    slide(c, dark=True)
    if LOGO.exists():
        c.drawImage(ImageReader(str(LOGO)), 58, 331, width=300, height=150, preserveAspectRatio=True, mask="auto")
    kicker(c, "India Runs / Intelligent Candidate Discovery", 58, 310, dark=True)
    heading(c, "Evalora ranks candidates the way a strong recruiter reasons.", 58, 250, 48, dark=True, width=610)
    paragraph(
        c,
        "A deterministic, CPU-only hybrid system for ranking the top 100 Senior AI Engineer candidates from the Redrob profile pool.",
        60,
        135,
        560,
        18,
        size=13,
        color=colors.HexColor("#b8c9d6"),
    )
    metrics = [
        (f"{report['input']['candidates_scored']:,}", "Profiles streamed"),
        (f"{report['input']['elapsed_ms'] / 1000:.1f}s", "Local CPU runtime"),
        ("0 API", "Hosted calls during ranking"),
    ]
    y = 330
    for value, label in metrics:
        c.setStrokeColor(colors.Color(1, 1, 1, alpha=0.18))
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.07))
        c.roundRect(705, y, 180, 70, 6, stroke=1, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 24)
        c.drawString(725, y + 38, value)
        c.setFillColor(colors.HexColor("#b8c9d6"))
        c.setFont("Helvetica", 10)
        c.drawString(725, y + 18, label)
        y -= 86
    c.showPage()


def draw_jd(c: canvas.Canvas) -> None:
    slide(c)
    kicker(c, "JD Interpretation", 58, 480)
    heading(c, "The right answer is production retrieval judgment, not AI keyword density.", 58, 432, 32, width=720)
    box(
        c,
        58,
        170,
        380,
        190,
        "What the role means",
        "The JD asks for a senior applied ML engineer who has shipped ranking, retrieval, semantic search, recommendations, or candidate-matching systems to real users. Strong evidence includes ownership, evaluation literacy, product pressure, and practical engineering depth.",
    )
    items = [
        ("Must-have", "Embeddings, hybrid search, vector databases, Python, production ranking, evaluation frameworks."),
        ("Useful", "LLM fine-tuning, learning-to-rank, HR-tech, distributed inference, open-source AI work."),
        ("Risks", "Services-only history, keyword-stuffed profiles, CV/speech-only work, stale activity."),
        ("Logistics", "Pune/Noida preferred; Indian metro or relocation fit; short notice and engagement matter."),
    ]
    x0, y0 = 470, 282
    for i, (title, body) in enumerate(items):
        x = x0 + (i % 2) * 220
        y = y0 - (i // 2) * 120
        box(c, x, y, 200, 94, title, body, accent=AMBER if i % 2 else VIOLET)
    footer(c, "Source: released job_description.docx and redrob_signals_doc.docx.")
    c.showPage()


def draw_architecture(c: canvas.Canvas) -> None:
    slide(c)
    kicker(c, "Architecture", 58, 480)
    heading(c, "Evalora uses a fast hybrid scorer that reads every profile end to end.", 58, 432, 32, width=720)
    steps = [
        ("1. JD interpreter", "Converts the JD into weighted role concepts: retrieval, ranking, evaluation, product depth, behavior, logistics, and risks."),
        ("2. Profile reader", "Streams JSONL candidates and extracts career text, skill depth, education, certifications, and all Redrob signals."),
        ("3. Evidence scorer", "Balances semantic career proof, title fit, skills, product history, availability, and consistency checks."),
        ("4. CSV writer", "Sorts deterministically and writes exactly 100 rows with profile-grounded reasoning."),
    ]
    for i, (title, body) in enumerate(steps):
        box(c, 58 + i * 218, 190, 194, 180, title, body, accent=AMBER)
        if i < 3:
            c.setStrokeColor(ACCENT)
            c.setLineWidth(2)
            c.line(252 + i * 218, 280, 274 + i * 218, 280)
            c.line(274 + i * 218, 280, 266 + i * 218, 286)
            c.line(274 + i * 218, 280, 266 + i * 218, 274)
    c.showPage()


def draw_scoring(c: canvas.Canvas) -> None:
    slide(c)
    kicker(c, "Scoring Model", 58, 480)
    heading(c, "The score favors evidence that survives a recruiter review.", 58, 432, 32, width=720)
    rows = [
        ("Semantic career proof", 22),
        ("Skill depth", 17),
        ("Title and seniority", 15),
        ("Career trajectory", 15),
        ("Behavioral readiness", 13),
        ("Experience window", 10),
        ("Location and integrity", 8),
    ]
    y = 350
    for label, value in rows:
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(70, y, label)
        c.setFillColor(colors.HexColor("#dfe7ef"))
        c.roundRect(310, y - 2, 450, 10, 5, stroke=0, fill=1)
        c.setFillColor(ACCENT if value >= 15 else AMBER)
        c.roundRect(310, y - 2, 450 * value / 25, 10, 5, stroke=0, fill=1)
        c.setFillColor(MUTED)
        c.drawRightString(805, y, f"{value}%")
        y -= 42
    footer(c, "Deterministic JavaScript ranker. No hosted LLM/API calls, no GPU, and no per-candidate model inference.")
    c.showPage()


def draw_trust(c: canvas.Canvas) -> None:
    slide(c)
    kicker(c, "Trust Layer", 58, 480)
    heading(c, "Behavioral signals and risk checks prevent attractive but unhireable matches.", 58, 432, 32, width=760)
    headers = ["Signal family", "How it changes rank"]
    data = [
        ["Recent activity", "Boosts candidates who are actually reachable now."],
        ["Recruiter response", "Rewards strong response rates and faster reply time."],
        ["Notice period", "Penalizes 90-180 day notice unless the rest of the fit is exceptional."],
        ["Verification", "Adds confidence for phone, email, LinkedIn, and GitHub signal."],
    ]
    draw_table(c, 58, 205, 520, headers, data)
    box(
        c,
        610,
        205,
        270,
        190,
        "Honeypot-resistant checks",
        "Evalora penalizes experience mismatches, high-proficiency skills with near-zero duration, keyword-heavy profiles without career proof, services-only histories, and CV/speech-heavy profiles without IR/NLP relevance.",
        accent=VIOLET,
    )
    c.showPage()


def draw_output(c: canvas.Canvas, report: dict, rows: list[list[str]]) -> None:
    slide(c)
    kicker(c, "Output", 58, 480)
    heading(c, "The generated shortlist is narrow, defensible, and validator-ready.", 58, 432, 32, width=760)
    data = []
    for row in rows:
        if len(row) >= 4:
            data.append([row[1], row[0], row[3][:112] + ("..." if len(row[3]) > 112 else "")])
    if not data:
        data = [["1", "CAND_0018499", "Senior ML profile with retrieval/ranking evidence and strong availability."]]
    draw_table(c, 58, 250, 824, ["Rank", "Candidate", "Reasoning excerpt"], data)
    box(c, 58, 95, 390, 105, "Validation", "Exactly 100 rows, ranks 1-100, unique candidate IDs, descending scores, UTF-8 CSV, and candidate IDs verified against the pool.")
    box(c, 492, 95, 390, 105, "Runtime", f"{report['input']['candidates_scored']:,} candidates scored in {report['input']['elapsed_ms'] / 1000:.1f} seconds locally; no network or GPU.")
    c.showPage()


def draw_package(c: canvas.Canvas) -> None:
    slide(c, dark=True)
    kicker(c, "Submission Package", 58, 480, dark=True)
    heading(c, "Evalora ships as a repo, product UI, ranker, validator, output CSV, and deck.", 58, 430, 36, dark=True, width=760)
    box(c, 58, 185, 390, 145, "Reproduce", "npm run rank streams the released candidate pool and writes the final top-100 CSV. npm run validate checks row count, ranks, candidate IDs, score ordering, and reasoning.")
    box(c, 492, 185, 390, 145, "Project", "Built with love by Yuvrajjit Baruah using HTML, CSS, JavaScript, Node.js, deterministic hybrid ranking, Figma-informed UI craft, and a lot of chai. Feedback: dev.yuvrajjitbaruah@gmail.com. GitHub: github.com/yuvrajjitbaruah/Evalora.", accent=AMBER)
    c.setFillColor(colors.HexColor("#b8c9d6"))
    c.setFont("Helvetica", 11)
    c.drawString(58, 72, "Final artifacts: outputs/evalora_submission.csv, docs/evalora_approach.pdf, and the Evalora web dashboard.")
    c.showPage()


def draw_table(c: canvas.Canvas, x: float, y: float, w: float, headers: list[str], data: list[list[str]]) -> None:
    col_widths = [70, 145, w - 215] if len(headers) == 3 else [160, w - 160]
    row_h = 44
    header_h = 34
    total_h = header_h + row_h * len(data)
    c.setStrokeColor(LINE)
    c.setFillColor(colors.white)
    c.roundRect(x, y, w, total_h, 6, stroke=1, fill=1)
    c.setFillColor(colors.HexColor("#eef3f8"))
    c.roundRect(x, y + total_h - header_h, w, header_h, 6, stroke=0, fill=1)
    cx = x
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(MUTED)
    for i, header in enumerate(headers):
        c.drawString(cx + 12, y + total_h - 22, header.upper())
        cx += col_widths[i]
    c.setFillColor(INK)
    c.setFont("Helvetica", 9)
    for r, row in enumerate(data):
        row_y = y + total_h - header_h - row_h * (r + 1)
        c.setStrokeColor(LINE)
        c.line(x, row_y + row_h, x + w, row_y + row_h)
        cx = x
        for i, cell in enumerate(row):
            if i == 2 or len(headers) == 2 and i == 1:
                paragraph(c, cell, cx + 12, row_y + row_h - 16, col_widths[i] - 24, 11, size=8.5, color=INK if i == 0 else MUTED)
            else:
                c.drawString(cx + 12, row_y + row_h - 24, cell)
            cx += col_widths[i]


def footer(c: canvas.Canvas, text: str) -> None:
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(58, 40, text)


if __name__ == "__main__":
    main()
