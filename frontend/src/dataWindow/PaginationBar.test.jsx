import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import PaginationBar from "./PaginationBar";

afterEach(() => {
  cleanup();
});

function renderBar({ page, totalPages, pageSizeLabel = "100 rows" }) {
  const onPrevious = vi.fn();
  const onNext = vi.fn();
  render(
    <PaginationBar
      page={page}
      totalPages={totalPages}
      pageSizeLabel={pageSizeLabel}
      previousLabel="Previous"
      nextLabel="Next"
      onPrevious={onPrevious}
      onNext={onNext}
    />,
  );
  return { onPrevious, onNext };
}

test("page 1 of 3 disables previous and enables next", () => {
  renderBar({ page: 1, totalPages: 3 });

  expect(screen.getByTestId("pagination-previous")).toBeDisabled();
  expect(screen.getByTestId("pagination-next")).toBeEnabled();
});

test("page 3 of 3 disables next", () => {
  renderBar({ page: 3, totalPages: 3 });

  expect(screen.getByTestId("pagination-next")).toBeDisabled();
  expect(screen.getByTestId("pagination-previous")).toBeEnabled();
});

test("page 1 of 0 disables both", () => {
  renderBar({ page: 1, totalPages: 0 });

  expect(screen.getByTestId("pagination-previous")).toBeDisabled();
  expect(screen.getByTestId("pagination-next")).toBeDisabled();
});

test("labels render", () => {
  renderBar({ page: 1, totalPages: 3, pageSizeLabel: "100 строк" });

  expect(screen.getByTestId("page-label").textContent).toBe("1 / 3");
  expect(screen.getByTestId("page-size").textContent).toBe("100 строк");
  expect(screen.getByTestId("pagination-previous")).toHaveTextContent("Previous");
  expect(screen.getByTestId("pagination-next")).toHaveTextContent("Next");
});

test("clicking next calls onNext once", () => {
  const { onPrevious, onNext } = renderBar({ page: 1, totalPages: 3 });

  fireEvent.click(screen.getByTestId("pagination-next"));

  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onPrevious).not.toHaveBeenCalled();
});
