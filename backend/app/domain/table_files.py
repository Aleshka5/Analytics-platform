"""Write a table as csv, json, or xlsx bytes."""

import csv
import io
import json
from typing import Any

from openpyxl import Workbook


def write_table(columns: list[str], rows: list[dict], fmt: str) -> bytes:
    """Return every row as a file in `fmt`.

    `csv` is UTF-8 with a BOM and a comma separator. `json` is an array of
    objects with keys in column order. `xlsx` is one sheet named `Data`.
    `None` is an empty cell in csv and xlsx, and JSON null.
    """

    if fmt == "csv":
        return _write_csv(columns, rows)
    if fmt == "json":
        return _write_json(columns, rows)
    if fmt == "xlsx":
        return _write_xlsx(columns, rows)
    raise ValueError(f"Unsupported table format: {fmt}")


def _cells(columns: list[str], row: dict[str, Any]) -> list[Any]:
    return [row.get(name) for name in columns]


def _write_csv(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow(columns)
    for row in rows:
        writer.writerow(_cells(columns, row))
    return buffer.getvalue().encode("utf-8-sig")


def _write_json(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    objects = [{name: row.get(name) for name in columns} for row in rows]
    return json.dumps(objects, ensure_ascii=False).encode("utf-8")


def _write_xlsx(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Data"
    sheet.append(list(columns))
    for row in rows:
        sheet.append(_cells(columns, row))
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
