"""PDF report built from shared report blocks, in the web page's visual style."""

import math
import re
from collections.abc import Sequence
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import Circle, Drawing, Line, PolyLine, Polygon, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.domain.report_model import ReportBlock, ReportTable

_FONTS = Path(__file__).resolve().parent.parent / "fonts"
_FONT = "DejaVuSans"
_FONT_BOLD = "DejaVuSans-Bold"

# The Freedom Broker palette from docs/design.md#visual-style.
_INK = colors.HexColor("#0E1512")
_INK_MUTED = colors.HexColor("#5B6660")
_ON_INK_MUTED = colors.HexColor("#C4CEC8")
_BRAND = colors.HexColor("#009753")
_BRAND_BRIGHT = colors.HexColor("#1AE276")
_BRAND_WASH = colors.HexColor("#E6F5EE")
_LINE = colors.HexColor("#E2E8E4")
_LINE_STRONG = colors.HexColor("#CBD4CE")
_SUNKEN = colors.HexColor("#F7F9F8")
_STRIPE = colors.HexColor("#FAFBFA")
_DANGER = colors.HexColor("#B42318")
_DANGER_WASH = colors.HexColor("#FEF3F2")

_PAGE_WIDTH, _PAGE_HEIGHT = A4
_MARGIN = 15 * mm
_BAND_HEIGHT = 30 * mm
_CHART_HEIGHT = 150
_NUMBER = re.compile(r"-?\d+(\.\d+)?([eE][-+]?\d+)?")
_KEY = re.compile(r"[a-z0-9_]+")
_PERCENTILES = {"p25": "25%", "p50": "50%", "p75": "75%"}
_SEPARATORS = {"en": (",", "."), "ru": ("\u202f", ",")}
_SPLIT_ROWS = 12
_SPLIT_PARTS = 3


def report_pdf(
    blocks: Sequence[ReportBlock],
    *,
    title: str = "Analytics report",
    subtitle: str = "",
    lang: str = "en",
) -> bytes:
    """Return the blocks as a PDF, in order.

    The first page opens with a dark title band. Each section is a numbered heading,
    then `message` in a red callout when it is set, otherwise its tables. Size becomes
    stat tiles, Dynamics gets a line chart above its table, and insight sentences
    become notes. Numbers are rounded to two decimals and grouped for `lang`.
    Page compression is off. Cyrillic uses the bundled DejaVu Sans font.
    """

    _register_fonts()
    styles = _styles()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        pageCompression=0,
        title=title,
        leftMargin=_MARGIN,
        rightMargin=_MARGIN,
        topMargin=_MARGIN,
        bottomMargin=_MARGIN + 6 * mm,
    )
    width = document.width
    story: list = [Spacer(1, _BAND_HEIGHT - _MARGIN)]
    for index, block in enumerate(blocks, start=1):
        story.append(_heading(index, block.title, styles["heading"]))
        if block.message is not None:
            story.append(_callout(block.message, styles["danger"], width))
        else:
            story.extend(_block_flowables(block, styles, width, lang))

    def first_page(canvas, doc) -> None:
        _draw_band(canvas, title, subtitle)
        _draw_footer(canvas, doc, title, subtitle)

    def later_page(canvas, doc) -> None:
        _draw_footer(canvas, doc, title, subtitle)

    document.build(story, onFirstPage=first_page, onLaterPages=later_page)
    return buffer.getvalue()


def _register_fonts() -> None:
    registered = pdfmetrics.getRegisteredFontNames()
    for name in (_FONT, _FONT_BOLD):
        path = _FONTS / f"{name}.ttf"
        if not path.is_file():
            raise FileNotFoundError(f"Report font is missing: {path}")
        if name not in registered:
            pdfmetrics.registerFont(TTFont(name, str(path)))
    pdfmetrics.registerFontFamily(_FONT, normal=_FONT, bold=_FONT_BOLD)


def _styles() -> dict[str, ParagraphStyle]:
    cell = ParagraphStyle("Cell", fontName=_FONT, fontSize=7.5, leading=9.5, textColor=_INK)
    return {
        "heading": ParagraphStyle(
            "Heading",
            fontName=_FONT_BOLD,
            fontSize=12.5,
            leading=18,
            textColor=_INK,
            spaceBefore=14,
            spaceAfter=8,
            keepWithNext=1,
        ),
        "cell": cell,
        "cell_right": ParagraphStyle("CellRight", parent=cell, alignment=TA_RIGHT),
        "header": ParagraphStyle(
            "Header", parent=cell, fontName=_FONT_BOLD, fontSize=6.5, textColor=_INK_MUTED
        ),
        "header_right": ParagraphStyle(
            "HeaderRight",
            parent=cell,
            fontName=_FONT_BOLD,
            fontSize=6.5,
            textColor=_INK_MUTED,
            alignment=TA_RIGHT,
        ),
        "danger": ParagraphStyle(
            "Danger", fontName=_FONT, fontSize=9.5, leading=13, textColor=_DANGER
        ),
        "note": ParagraphStyle("Note", fontName=_FONT, fontSize=9.5, leading=13, textColor=_INK),
        "tile_label": ParagraphStyle(
            "TileLabel", fontName=_FONT, fontSize=8, leading=10, textColor=_INK_MUTED
        ),
        "tile_value": ParagraphStyle(
            "TileValue", fontName=_FONT_BOLD, fontSize=24, leading=28, textColor=_INK
        ),
    }


def _heading(index: int, title: str, style: ParagraphStyle) -> Paragraph:
    chip = f'<font backColor="#0E1512" color="#1AE276" size="9">&nbsp;{index:02d}&nbsp;</font>'
    return Paragraph(f"{chip}&nbsp;&nbsp;{escape(title)}", style)


def _block_flowables(
    block: ReportBlock, styles: dict[str, ParagraphStyle], width: float, lang: str
) -> list:
    flowables: list = []
    if block.sheet == "Shape" and block.tables:
        flowables.append(_tiles(block.tables[0], styles, width, lang))
        return flowables
    if block.sheet == "Timeseries" and block.tables:
        chart = _chart(block.tables[0], width)
        if chart is not None:
            flowables.extend([chart, Spacer(1, 8)])
    for table in block.tables:
        if block.sheet == "Insights" and table.headers == ("text",):
            flowables.extend(_notes(table, styles["note"], width))
            continue
        flowable = _table_flowable(table, styles, width, lang)
        if flowable is not None:
            flowables.extend([flowable, Spacer(1, 8)])
    return flowables


# Page furniture


def _draw_band(canvas, title: str, subtitle: str) -> None:
    top = _PAGE_HEIGHT
    canvas.saveState()
    canvas.setFillColor(_INK)
    canvas.rect(0, top - _BAND_HEIGHT, _PAGE_WIDTH, _BAND_HEIGHT, stroke=0, fill=1)
    canvas.setFillColor(_BRAND_BRIGHT)
    canvas.rect(0, top - _BAND_HEIGHT, _PAGE_WIDTH, 1.5, stroke=0, fill=1)
    _draw_mark(canvas, _MARGIN, top - _BAND_HEIGHT / 2 - 5 * mm, 10 * mm)
    text_x = _MARGIN + 14 * mm
    canvas.setFillColor(colors.white)
    canvas.setFont(_FONT_BOLD, 17)
    canvas.drawString(text_x, top - _BAND_HEIGHT / 2 + 1 * mm, title)
    if subtitle:
        canvas.setFillColor(_ON_INK_MUTED)
        canvas.setFont(_FONT, 8.5)
        canvas.drawString(text_x, top - _BAND_HEIGHT / 2 - 4.5 * mm, subtitle)
    canvas.restoreState()


def _draw_mark(canvas, x: float, y: float, size: float) -> None:
    """The header logo: a rounded square with a rising green line."""

    canvas.setStrokeColor(_BRAND_BRIGHT)
    canvas.setFillColor(_INK)
    canvas.setLineWidth(1)
    canvas.roundRect(x, y, size, size, size * 0.28, stroke=1, fill=1)
    canvas.setLineWidth(size * 0.09)
    canvas.setLineCap(1)
    canvas.setLineJoin(1)
    unit = size / 32
    path = canvas.beginPath()
    path.moveTo(x + 8 * unit, y + (32 - 21) * unit)
    path.lineTo(x + 13 * unit, y + (32 - 15) * unit)
    path.lineTo(x + 17 * unit, y + (32 - 18) * unit)
    path.lineTo(x + 24 * unit, y + (32 - 10) * unit)
    canvas.drawPath(path, stroke=1, fill=0)


def _draw_footer(canvas, doc, title: str, subtitle: str) -> None:
    canvas.saveState()
    y = _MARGIN - 2 * mm
    canvas.setStrokeColor(_LINE)
    canvas.setLineWidth(0.5)
    canvas.line(_MARGIN, y + 4 * mm, _PAGE_WIDTH - _MARGIN, y + 4 * mm)
    canvas.setFillColor(_INK_MUTED)
    canvas.setFont(_FONT, 7)
    label = f"{title} · {subtitle}" if subtitle else title
    canvas.drawString(_MARGIN, y, label)
    canvas.setFillColor(_BRAND)
    canvas.setFont(_FONT_BOLD, 7)
    canvas.drawRightString(_PAGE_WIDTH - _MARGIN, y, str(doc.page))
    canvas.restoreState()


# Section bodies


def _callout(text: str, style: ParagraphStyle, width: float) -> Table:
    box = Table([[Paragraph(escape(text), style)]], colWidths=[width])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _DANGER_WASH),
                ("BOX", (0, 0), (-1, -1), 0.75, _DANGER),
                ("ROUNDEDCORNERS", [6, 6, 6, 6]),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return box


def _tiles(
    table: ReportTable, styles: dict[str, ParagraphStyle], width: float, lang: str
) -> Table:
    values = table.rows[0] if table.rows else ()
    cells = [
        [
            Paragraph(escape(_label(header)), styles["tile_label"]),
            Paragraph(escape(_display(value, lang)), styles["tile_value"]),
        ]
        for header, value in zip(table.headers, values)
    ]
    gap = 8
    count = max(len(cells), 1)
    tile_width = (width - gap * (count - 1)) / count
    tiles = []
    for cell in cells:
        tile = Table([[cell[0]], [cell[1]]], colWidths=[tile_width])
        tile.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), _SUNKEN),
                    ("ROUNDEDCORNERS", [8, 8, 8, 8]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
                ]
            )
        )
        tiles.append(tile)
    row = Table([tiles], colWidths=[tile_width + gap] * (count - 1) + [tile_width])
    row.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return row


def _notes(table: ReportTable, style: ParagraphStyle, width: float) -> list:
    notes: list = []
    for row in table.rows:
        text = row[0] if row else ""
        note = Table([[Paragraph(f'<font color="#009753">✦</font>&nbsp;&nbsp;{escape(text)}', style)]], colWidths=[width])
        note.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), _BRAND_WASH),
                    ("ROUNDEDCORNERS", [6, 6, 6, 6]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        notes.extend([note, Spacer(1, 5)])
    return notes


def _table_flowable(
    table: ReportTable, styles: dict[str, ParagraphStyle], width: float, lang: str
) -> Table | None:
    """A styled table. A long table of one or two columns flows into three columns."""

    if len(table.headers) <= 2 and len(table.rows) > _SPLIT_ROWS:
        return _split_table(table, styles, width, lang)
    grid = _grid(table)
    if not grid:
        return None
    body = grid[1:] if table.headers else grid
    columns = len(grid[0])
    numeric = [_is_numeric_column(row[index] for row in body) for index in range(columns)]
    texts: list[list[tuple[str, ParagraphStyle]]] = []
    for row_index, row in enumerate(grid):
        is_header = bool(table.headers) and row_index == 0
        cells = []
        for column, value in enumerate(row):
            if is_header:
                style = styles["header_right" if numeric[column] else "header"]
                cells.append((_label(value).upper(), style))
            else:
                style = styles["cell_right" if numeric[column] else "cell"]
                cells.append((_display(value, lang) if numeric[column] else value, style))
        texts.append(cells)
    data = [[Paragraph(escape(text), style) for text, style in row] for row in texts]
    flowable = Table(
        data,
        colWidths=_column_widths(texts, width),
        repeatRows=1 if table.headers else 0,
    )
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, _LINE),
        ("ROWBACKGROUNDS", (0, 1 if table.headers else 0), (-1, -1), [colors.white, _STRIPE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    if table.headers:
        commands += [
            ("BACKGROUND", (0, 0), (-1, 0), _SUNKEN),
            ("LINEBELOW", (0, 0), (-1, 0), 0.75, _LINE_STRONG),
        ]
    flowable.setStyle(TableStyle(commands))
    return flowable


def _split_table(
    table: ReportTable, styles: dict[str, ParagraphStyle], width: float, lang: str
) -> Table:
    gap = 12
    part_width = (width - gap * (_SPLIT_PARTS - 1)) / _SPLIT_PARTS
    chunks = [
        table.rows[start : start + _SPLIT_ROWS] for start in range(0, len(table.rows), _SPLIT_ROWS)
    ]
    parts: list = [
        _table_flowable(ReportTable(headers=table.headers, rows=chunk), styles, part_width, lang)
        for chunk in chunks
    ]
    while len(parts) % _SPLIT_PARTS:
        parts.append("")
    rows = [parts[start : start + _SPLIT_PARTS] for start in range(0, len(parts), _SPLIT_PARTS)]
    outer = Table(rows, colWidths=[part_width + gap] * (_SPLIT_PARTS - 1) + [part_width])
    outer.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-2, -1), gap),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return outer


def _chart(table: ReportTable, width: float) -> Drawing | None:
    """A line of `sum` by `bucket`: rounded ticks, a 10% area wash, and the last value."""

    points = []
    for row in table.rows:
        value = _number(row[1]) if len(row) > 1 else None
        if value is not None:
            points.append((row[0], value))
    if len(points) < 2:
        return None
    left, right, top, bottom = 40, 44, 8, 18
    inner_width = width - left - right
    inner_height = _CHART_HEIGHT - top - bottom
    ticks = _ticks([value for _, value in points])
    low, high = ticks[0], ticks[-1]
    last = len(points) - 1

    def x(index: int) -> float:
        return left + index / last * inner_width

    def y(value: float) -> float:
        return bottom + (value - low) / (high - low) * inner_height

    drawing = Drawing(width, _CHART_HEIGHT)
    for tick in ticks:
        drawing.add(Line(left, y(tick), left + inner_width, y(tick), strokeColor=_LINE, strokeWidth=0.5))
        drawing.add(
            String(left - 6, y(tick) - 2.5, _compact(tick), fontName=_FONT, fontSize=6.5, fillColor=_INK_MUTED, textAnchor="end")
        )
    coordinates = [coordinate for index, (_, value) in enumerate(points) for coordinate in (x(index), y(value))]
    area = [x(0), y(low), *coordinates, x(last), y(low)]
    drawing.add(Polygon(area, fillColor=_BRAND, fillOpacity=0.1, strokeColor=None, strokeWidth=0))
    drawing.add(PolyLine(coordinates, strokeColor=_BRAND, strokeWidth=1.5, strokeLineJoin=1, strokeLineCap=1))
    end_x, end_y = x(last), y(points[last][1])
    drawing.add(Circle(end_x, end_y, 3, fillColor=_BRAND, strokeColor=colors.white, strokeWidth=1.5))
    drawing.add(String(end_x + 6, end_y - 2.5, _compact(points[last][1]), fontName=_FONT_BOLD, fontSize=7, fillColor=_INK))
    for index, anchor in ((0, "start"), (last // 2, "middle"), (last, "end")):
        drawing.add(
            String(x(index), 4, points[index][0], fontName=_FONT, fontSize=6.5, fillColor=_INK_MUTED, textAnchor=anchor)
        )
    return drawing


# Helpers


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


def _column_widths(texts: list[list[tuple[str, ParagraphStyle]]], width: float) -> list[float]:
    """Give each column the width of its widest text, then share what is left or missing.

    A column never asks for more than 40% of the table, so one long text wraps
    instead of squeezing every other column.
    """

    padding = 10
    natural = []
    for index in range(len(texts[0])):
        widest = max(
            pdfmetrics.stringWidth(text, style.fontName, style.fontSize) for text, style in (row[index] for row in texts)
        )
        natural.append(min(widest + padding, width * 0.4))
    total = sum(natural)
    return [width * share / total for share in natural]


def _is_numeric_column(values) -> bool:
    seen = False
    for value in values:
        if value == "":
            continue
        if not _NUMBER.fullmatch(value):
            return False
        seen = True
    return seen


def _number(value: str) -> float | None:
    if not _NUMBER.fullmatch(value or ""):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _label(header: str) -> str:
    """Turn an API key such as `missing_pct` into `Missing %`. Column names stay as they are."""

    if not _KEY.fullmatch(header):
        return header
    if header in _PERCENTILES:
        return _PERCENTILES[header]
    words = ["%" if word == "pct" else word for word in header.split("_")]
    text = " ".join(words)
    return text[:1].upper() + text[1:]


def _display(value: str, lang: str) -> str:
    """Round to two decimals and group thousands, as the web page does."""

    number = _number(value)
    if number is None:
        return value
    thousands, decimal = _SEPARATORS.get(lang, _SEPARATORS["en"])
    text = f"{round(number, 2):,.2f}".rstrip("0").rstrip(".")
    return text.replace(",", "\0").replace(".", decimal).replace("\0", thousands)


def _ticks(values: list[float]) -> list[float]:
    low, high = min(values), max(values)
    raw = (high - low) / 3 or 1
    power = 10 ** math.floor(math.log10(raw))
    unit = raw / power
    step = (1 if unit <= 1 else 2 if unit <= 2 else 5 if unit <= 5 else 10) * power
    start = math.floor(low / step) * step
    end = max(math.ceil(high / step) * step, start + step)
    ticks = []
    tick = start
    while tick <= end + step / 2:
        ticks.append(tick)
        tick += step
    return ticks


def _compact(value: float) -> str:
    for size, suffix in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(value) >= size:
            return f"{value / size:.1f}".rstrip("0").rstrip(".") + suffix
    return f"{value:.2f}".rstrip("0").rstrip(".")
