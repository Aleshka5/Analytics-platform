"""Errors raised by the row-query domain. The HTTP layer maps `code` to a message."""


class QueryRejected(Exception):
    """A filter, sort, group, or page value violates the row-query contract.

    `code` is `invalid_filter`, `invalid_sort`, `invalid_group`, or `invalid_page`.
    `index` is the zero-based condition index for a bad filter condition, otherwise None.
    """

    def __init__(self, code: str, index: int | None = None) -> None:
        self.code = code
        self.index = index
        super().__init__(code if index is None else f"{code}:{index}")
