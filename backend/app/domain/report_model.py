"""Shared report blocks for the Excel and PDF writers."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ReportTable:
    """One simple table. Cells are display strings. An empty string is an empty cell."""

    headers: tuple[str, ...]
    rows: tuple[tuple[str, ...], ...]


@dataclass(frozen=True)
class ReportBlock:
    """One of the ten report sections.

    `sheet` is the English Excel tab name.
    `title` is the localized heading written inside the sheet or PDF section.
    When the section is unavailable, `message` is set and `tables` is empty.
    """

    sheet: str
    title: str
    message: str | None
    tables: tuple[ReportTable, ...]
