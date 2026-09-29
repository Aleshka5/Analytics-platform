import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, test } from "vitest";
import "../i18n";
import Header from "./Header";

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

test("switches the heading to Russian and stores ru", () => {
  render(<Header />);
  fireEvent.click(screen.getByRole("button", { name: "RU" }));
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Аналитическая платформа",
  );
  expect(localStorage.getItem("lang")).toBe("ru");
  expect(screen.getByRole("button", { name: "RU" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("switches the heading to English and stores en", () => {
  render(<Header />);
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(screen.getByRole("heading")).toHaveTextContent("Analytics Platform");
  expect(localStorage.getItem("lang")).toBe("en");
});
