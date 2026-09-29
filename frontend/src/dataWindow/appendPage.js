function sameValue(left, right) {
  if (left == null && right == null) {
    return true;
  }
  return left === right;
}

function joinedSpans(rows, spans) {
  const columns = [];
  for (const span of spans) {
    if (span?.column && !columns.includes(span.column)) {
      columns.push(span.column);
    }
  }
  const joined = [];
  for (const column of columns) {
    let start = 0;
    for (let index = 1; index <= rows.length; index += 1) {
      const atEnd = index === rows.length;
      if (atEnd || !sameValue(rows[start]?.[column], rows[index]?.[column])) {
        const length = index - start;
        if (length >= 2) {
          joined.push({ column, start_row: start, length });
        }
        start = index;
      }
    }
  }
  return joined;
}

export function appendRowsPage(current, page) {
  const incomingRows = page.rows || [];
  const rows = current ? current.rows.concat(incomingRows) : incomingRows.slice();
  const spans = joinedSpans(rows, [...(current?.spans || []), ...(page.spans || [])]);
  return {
    columns: page.columns,
    rows,
    spans,
    page: page.page,
    total_pages: page.total_pages,
    group: page.group,
  };
}
