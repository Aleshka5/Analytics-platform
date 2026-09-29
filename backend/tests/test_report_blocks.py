from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.domain.messages import message
from app.domain.report_model import ReportBlock
from app.infrastructure.store import DatasetStore, set_store
from app.services.datasets import create_dataset
from app.services.report_blocks import build_report

_SHEETS = [
    "Preview",
    "Columns",
    "Shape",
    "Types",
    "Missing",
    "Summary",
    "Ranking",
    "Grouping",
    "Timeseries",
    "Insights",
]

_TITLES_EN = [
    "Preview",
    "Columns",
    "Size",
    "Data types",
    "Missing values",
    "Summary",
    "Top and worst",
    "Grouping",
    "Dynamics",
    "Insights",
]

_TITLES_RU = [
    "Просмотр",
    "Колонки",
    "Размер",
    "Типы данных",
    "Пропуски",
    "Сводка",
    "Лучшие и худшие",
    "Группировка",
    "Динамика",
    "Инсайты",
]


def _sample_workbook() -> Path:
    container = Path("/data/global_brokerage_dataset.xlsx")
    if container.exists():
        return container
    return Path(__file__).resolve().parents[2] / "data" / "global_brokerage_dataset.xlsx"


class _Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture(autouse=True)
def store():
    holder = _Clock(datetime.now(timezone.utc).replace(microsecond=0))
    set_store(DatasetStore(ttl=timedelta(minutes=60), clock=holder))
    yield holder
    set_store(None)


def _insight_cells(block: ReportBlock) -> str:
    parts: list[str] = []
    for table in block.tables:
        if "text" not in table.headers:
            continue
        index = table.headers.index("text")
        for row in table.rows:
            parts.append(row[index])
    return "\n".join(parts)


def test_sample_report_has_ten_english_sheets_and_localized_insights() -> None:
    workbook = _sample_workbook()
    content = workbook.read_bytes()
    dataset = create_dataset(
        filename=workbook.name,
        content=content,
        sheet="Brokerage_Data",
        content_length=len(content),
    )

    english = build_report(dataset, "en")
    assert len(english) == 10
    assert [block.sheet for block in english] == _SHEETS
    assert [block.title for block in english] == _TITLES_EN
    assert len(english[0].tables[0].rows) <= 20
    insight_text = _insight_cells(english[-1])
    assert "PnL decreased by" in insight_text
    assert "2025-01-01" in insight_text
    assert english[6].tables[0].headers[0] == "Top"

    russian = build_report(dataset, "ru")
    assert len(russian) == 10
    assert [block.sheet for block in russian] == _SHEETS
    assert [block.title for block in russian] == _TITLES_RU
    assert "PnL снизился на" in _insight_cells(russian[-1])
    assert russian[6].tables[0].headers[0] == "Лучшие"


def test_timeseries_without_a_date_column_is_a_message_among_ten_blocks() -> None:
    content = b"name,amount\nalice,10\nbob,20\n"
    dataset = create_dataset(
        filename="plain.csv",
        content=content,
        sheet=None,
        content_length=len(content),
    )

    blocks = build_report(dataset, "en")
    assert len(blocks) == 10
    assert [block.sheet for block in blocks] == _SHEETS
    timeseries = blocks[8]
    assert timeseries.sheet == "Timeseries"
    assert timeseries.message == message("no_datetime_column", "en")
    assert timeseries.tables == ()
