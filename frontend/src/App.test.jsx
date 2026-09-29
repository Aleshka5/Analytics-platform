import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { expect, test } from "vitest";
import App from "./App";

test("renders the product name", () => {
  render(<App />);
  expect(screen.getByText("Analytics Platform")).toBeInTheDocument();
});
