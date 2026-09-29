import io
import json
from pathlib import Path

import pandas as pd
import pytest
from openpyxl import Workbook

from app.infrastructure.readers import ReadRejected, read_table, sheet_names


def _file(tmp_path: Path, name: str, content: bytes) -> bytes:
    path = tmp_path / name
    path.write_bytes(content)
    return path.read_bytes()


def _xlsx(tmp_path: Path, name: str, sheets: dict[str, list[list[object]]]) -> bytes:
    workbook = Workbook()
    titles = list(sheets)
    first = workbook.active
    first.title = titles[0]
    for title in titles[1:]:
        workbook.create_sheet(title)
    for title, rows in sheets.items():
        worksheet = workbook[title]
        for row in rows:
            worksheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return _file(tmp_path, name, buffer.getvalue())


def test_csv_header_and_rows(tmp_path: Path) -> None:
    content = _file(tmp_path, "data.CSV", "Name,City\nAnna,Москва\n".encode())

    frame = read_table(content, "data.CSV", None)

    assert list(frame.columns) == ["Name", "City"]
    assert list(frame.index) == [0]
    assert frame.loc[0, "Name"] == "Anna"
    assert frame.loc[0, "City"] == "Москва"


def test_tsv_and_semicolon_delimiter(tmp_path: Path) -> None:
    tsv = _file(tmp_path, "data.tsv", "Name\tQty\nAda\t2\n".encode())
    semi = _file(tmp_path, "data.csv", "Name;Qty\nAda;2\n".encode())

    tsv_frame = read_table(tsv, "data.tsv", None)
    semi_frame = read_table(semi, "data.csv", None)

    assert tsv_frame.loc[0, "Qty"] == 2
    assert semi_frame.loc[0, "Qty"] == 2


def test_empty_cell_is_missing(tmp_path: Path) -> None:
    content = _file(tmp_path, "gaps.csv", b"Name,City\nAnna,\n")

    frame = read_table(content, "gaps.csv", None)

    assert pd.isna(frame.loc[0, "City"])


def test_duplicate_headers(tmp_path: Path) -> None:
    content = _file(tmp_path, "dup.csv", b"Name,Name,Name\na,b,c\n")

    frame = read_table(content, "dup.csv", None)

    assert list(frame.columns) == ["Name", "Name_2", "Name_3"]
    assert frame.iloc[0].tolist() == ["a", "b", "c"]


def test_header_only_has_no_data_rows(tmp_path: Path) -> None:
    content = _file(tmp_path, "header.csv", b"Name,Value\n")

    with pytest.raises(ReadRejected) as caught:
        read_table(content, "header.csv", None)

    assert caught.value.code == "no_data_rows"


def test_empty_header_is_not_a_table(tmp_path: Path) -> None:
    content = _file(tmp_path, "blank.csv", b",Value\n1,2\n")

    with pytest.raises(ReadRejected) as caught:
        read_table(content, "blank.csv", None)

    assert caught.value.code == "not_a_table"


def test_unsupported_extension(tmp_path: Path) -> None:
    content = _file(tmp_path, "notes.txt", b"Name,Value\n1,2\n")

    with pytest.raises(ReadRejected) as caught:
        read_table(content, "notes.txt", None)

    assert caught.value.code == "unsupported_format"


def test_one_sheet_xlsx(tmp_path: Path) -> None:
    content = _xlsx(tmp_path, "book.xlsx", {"Data": [["Name", "Value"], ["a", 1]]})

    assert sheet_names(content, "book.xlsx") == ["Data"]
    frame = read_table(content, "book.xlsx", "Data")

    assert list(frame.columns) == ["Name", "Value"]
    assert frame.loc[0, "Value"] == 1


def test_two_sheet_xlsx_selects_named_sheet(tmp_path: Path) -> None:
    content = _xlsx(
        tmp_path,
        "book.xlsx",
        {
            "Trades": [["Name"], ["spot"]],
            "Clients": [["Id"], [7]],
        },
    )

    assert sheet_names(content, "book.xlsx") == ["Trades", "Clients"]
    trades = read_table(content, "book.xlsx", "Trades")
    clients = read_table(content, "book.xlsx", "Clients")

    assert trades.loc[0, "Name"] == "spot"
    assert clients.loc[0, "Id"] == 7


def test_unknown_sheet_name(tmp_path: Path) -> None:
    content = _xlsx(tmp_path, "book.xlsx", {"Trades": [["Name"], ["spot"]]})

    with pytest.raises(ReadRejected) as caught:
        read_table(content, "book.xlsx", "Missing")

    assert caught.value.code == "sheet_not_found"


def test_json_array_and_empty_string(tmp_path: Path) -> None:
    payload = [{"City": "Москва", "Note": ""}, {"City": "Kazan", "Note": "ok"}]
    content = _file(tmp_path, "rows.json", json.dumps(payload).encode())

    frame = read_table(content, "rows.json", None)

    assert list(frame.columns) == ["City", "Note"]
    assert frame.loc[0, "City"] == "Москва"
    assert pd.isna(frame.loc[0, "Note"])
    assert frame.loc[1, "Note"] == "ok"


def test_ndjson(tmp_path: Path) -> None:
    content = _file(tmp_path, "rows.json", b'{"City": "A"}\n{"City": "B"}\n')

    frame = read_table(content, "rows.json", None)

    assert frame["City"].tolist() == ["A", "B"]


def test_json_object_and_scalar_array_are_not_tables(tmp_path: Path) -> None:
    obj = _file(tmp_path, "one.json", b'{"City": "A"}')
    scalars = _file(tmp_path, "nums.json", b"[1, 2]")

    with pytest.raises(ReadRejected) as obj_caught:
        read_table(obj, "one.json", None)
    with pytest.raises(ReadRejected) as scalar_caught:
        read_table(scalars, "nums.json", None)

    assert obj_caught.value.code == "not_a_table"
    assert scalar_caught.value.code == "not_a_table"


def test_parquet(tmp_path: Path) -> None:
    source = pd.DataFrame({"Name": ["Ada"], "Qty": [3]})
    buffer = io.BytesIO()
    source.to_parquet(buffer, engine="pyarrow")
    content = _file(tmp_path, "rows.parquet", buffer.getvalue())

    frame = read_table(content, "rows.parquet", None)

    assert list(frame.columns) == ["Name", "Qty"]
    assert frame.loc[0, "Name"] == "Ada"
    assert frame.loc[0, "Qty"] == 3


def test_corrupt_xlsx_and_parquet(tmp_path: Path) -> None:
    broken_xlsx = _file(tmp_path, "bad.xlsx", b"not a workbook")
    broken_parquet = _file(tmp_path, "bad.parquet", b"not parquet")

    with pytest.raises(ReadRejected) as xlsx_caught:
        sheet_names(broken_xlsx, "bad.xlsx")
    with pytest.raises(ReadRejected) as parquet_caught:
        read_table(broken_parquet, "bad.parquet", None)

    assert xlsx_caught.value.code == "unreadable_file"
    assert parquet_caught.value.code == "unreadable_file"
