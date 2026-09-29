from io import BytesIO

from pypdf import PdfReader

from app.domain.report_model import ReportBlock, ReportTable
from app.domain.report_pdf import report_pdf


def _text(pdf: bytes) -> str:
    reader = PdfReader(BytesIO(pdf))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def test_english_sentence_is_in_the_pdf() -> None:
    sentence = "PnL decreased by 30.1%"
    blocks = [
        ReportBlock(
            sheet="Insights",
            title="Insights",
            message=None,
            tables=(ReportTable(headers=("text",), rows=((sentence,),)),),
        )
    ]

    text = _text(report_pdf(blocks))

    assert sentence in text


def test_russian_title_and_message_are_extracted() -> None:
    title = "Динамика"
    message = "Для этого блока нет колонки с датой."
    blocks = [
        ReportBlock(
            sheet="Timeseries",
            title=title,
            message=message,
            tables=(),
        )
    ]

    text = _text(report_pdf(blocks))

    assert title in text
    assert message in text


def test_unavailable_message_does_not_raise() -> None:
    message = "There is no date column for this block."
    blocks = [
        ReportBlock(
            sheet="Timeseries",
            title="Dynamics",
            message=message,
            tables=(),
        )
    ]

    text = _text(report_pdf(blocks))

    assert message in text


def test_first_page_has_the_title_band_and_a_page_number() -> None:
    blocks = [
        ReportBlock(
            sheet="Shape",
            title="Size",
            message=None,
            tables=(ReportTable(headers=("row_count", "column_count"), rows=(("1200", "7"),)),),
        )
    ]

    pdf = report_pdf(blocks, title="Analytics report", subtitle="trades.xlsx · 2025-01-01")
    first = PdfReader(BytesIO(pdf)).pages[0].extract_text()

    assert "Analytics report" in first
    assert "trades.xlsx · 2025-01-01" in first
    assert "01" in first
    assert "Row count" in first
    assert "1,200" in first


def test_russian_numbers_are_rounded_and_grouped() -> None:
    blocks = [
        ReportBlock(
            sheet="Grouping",
            title="Группировка",
            message=None,
            tables=(ReportTable(headers=("value", "sum"), rows=(("UAE", "1234567.891"),)),),
        )
    ]

    text = _text(report_pdf(blocks, lang="ru")).replace(" ", " ")

    assert "1 234 567,89" in text
    assert "1234567.891" not in text


def test_long_timeseries_keeps_every_bucket_next_to_its_chart() -> None:
    rows = tuple((f"2025-01-{day:02d}", str(day * 10.5)) for day in range(1, 32))
    rows += tuple((f"2025-02-{day:02d}", "") for day in range(1, 20))
    blocks = [
        ReportBlock(
            sheet="Timeseries",
            title="Dynamics",
            message=None,
            tables=(ReportTable(headers=("bucket", "sum"), rows=rows),),
        )
    ]

    text = _text(report_pdf(blocks))

    for bucket, _ in rows:
        assert bucket in text
    assert "325.5" in text
