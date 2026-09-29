from dataclasses import dataclass
from typing import Any, Literal

Role = Literal["metric", "datetime", "category", "text"]


@dataclass(frozen=True)
class ColumnInfo:
    name: str
    dtype: str
    role: Role
    unique_count: int


@dataclass(frozen=True)
class Suggestions:
    metric: str | None
    category: str | None
    datetime: str | None


@dataclass(frozen=True)
class SectionResult:
    """A report block. `code` is set only when status is unavailable."""

    status: Literal["ok", "unavailable"]
    data: dict[str, Any] | None = None
    code: str | None = None


class ColumnRejected(Exception):
    """The caller named an unknown column or a column of the wrong role.

    The HTTP layer maps this to 422 invalid_column.
    """
