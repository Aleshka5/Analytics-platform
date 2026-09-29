import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test } from "vitest";
import LineChart from "./LineChart";

afterEach(() => {
  cleanup();
});

const points = [
  { bucket: "2025-01-01", sum: 10 },
  { bucket: "2025-01-02", sum: 1250 },
  { bucket: "2025-01-03", sum: 42 },
];

test("keyboard focus shows the last bucket and arrow keys move the readout", () => {
  render(<LineChart points={points} locale="en" />);
  const chart = screen.getByTestId("line-chart");

  expect(screen.queryByTestId("chart-readout")).not.toBeInTheDocument();
  fireEvent.focus(chart);
  expect(screen.getByTestId("chart-readout")).toHaveTextContent("42");

  fireEvent.keyDown(chart, { key: "ArrowLeft" });
  expect(screen.getByTestId("chart-readout")).toHaveTextContent("1,250");

  fireEvent.keyDown(chart, { key: "ArrowRight" });
  fireEvent.keyDown(chart, { key: "ArrowRight" });
  expect(screen.getByTestId("chart-readout")).toHaveTextContent("42");

  fireEvent.blur(chart);
  expect(screen.queryByTestId("chart-readout")).not.toBeInTheDocument();
});
