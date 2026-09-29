"""PDF report built from shared report blocks."""

from collections.abc import Sequence
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.domain.report_model import ReportBlock, ReportTable

_FONT_NAME = "DejaVuSans"
_FONT_FILE = Path(__file__).resolve().parent.parent / "fonts" / "DejaVuSans.ttf"


def report_pdf(blocks: Sequence[ReportBlock]) -> bytes:
    """Return the blocks as a PDF, in order.

    Each section is a heading, then `message` when it is set, otherwise the tables.
    Page compression is off. Cyrillic uses the bundled DejaVu Sans font.
    """

    font = _register_font()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        pageCompression=0,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )
    heading = ParagraphStyle(
        "ReportHeading",
        fontName=font,
        fontSize=14,
        leading=18,
        spaceAfter=4,
    )
    body = ParagraphStyle(
        "ReportBody",
        fontName=font,
        fontSize=10,
        leading=13,
    )
    cell = ParagraphStyle(
        "ReportCell",
        fontName=font,
        fontSize=8,
        leading=10,
    )
    story = []
    for block in blocks:
        story.append(Paragraph(escape(block.title), heading))
        if block.message is not None:
            story.append(Paragraph(escape(block.message), body))
        else:
            for table in block.tables:
                flowable = _table_flowable(table, cell, document.width)
                if flowable is not None:
                    story.append(flowable)
                    story.append(Spacer(1, 6))
        story.append(Spacer(1, 8))
    document.build(story)
    return buffer.getvalue()


def _register_font() -> str:
    if not _FONT_FILE.is_file():
        raise FileNotFoundError(f"Report font is missing: {_FONT_FILE}")
    if _FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(_FONT_NAME, str(_FONT_FILE)))
    return _FONT_NAME


def _table_flowable(
    table: ReportTable, style: ParagraphStyle, width: float
) -> Table | None:
    grid = _grid(table)
    if not grid:
        return None
    columns = len(grid[0])
    data = [[Paragraph(escape(value), style) for value in row] for row in grid]
    flowable = Table(
        data,
        colWidths=[width / columns] * columns,
        repeatRows=1 if table.headers else 0,
    )
    commands = [
        ("FONTNAME", (0, 0), (-1, -1), style.fontName),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
    if table.headers:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F2F2")))
    flowable.setStyle(TableStyle(commands))
    return flowable


def _grid(table: ReportTable) -> list[list[str]]:
    column_count = len(table.headers)
    for row in table.rows:
        column_count = max(column_count, len(row))
    if column_count == 0:
        return []
    grid: list[list[str]] = []
    if table.headers:
        grid.append(_pad(table.headers, column_count))
    for row in table.rows:
        grid.append(_pad(row, column_count))
    return grid


def _pad(values: Sequence[str], column_count: int) -> list[str]:
    cells = list(values)
    if len(cells) < column_count:
        cells.extend([""] * (column_count - len(cells)))
    return cells[:column_count]
