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
