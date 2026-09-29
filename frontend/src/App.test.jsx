import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, test } from "vitest";
import App from "./App";
import { setLanguage } from "./i18n";
import { MAX_UPLOAD_BYTES } from "./upload/validateFile";

const CARD_TITLES = [
  "Preview",
  "Columns",
  "Size",
  "Data types",
  "Missing values",
  "Summary",
  "Top and worst",
  "Grouping",
  "Dynamics",
  "Insights",
];

function fileWith(name, size) {
  const file = new File(["x"], name, { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function pickFile(name, size) {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [fileWith(name, size)] } });
}

beforeEach(async () => {
  cleanup();
  localStorage.clear();
  await setLanguage("en");
});

test("renders the product name", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Analytics Platform");
});

test("language switch flips a header string and an upload string", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Analytics Platform");
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Upload file");

  fireEvent.click(screen.getByRole("button", { name: "RU" }));

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Аналитическая платформа");
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Загрузить файл");
  expect(localStorage.getItem("lang")).toBe("ru");
});

test("rejects a file over 100 MB and a disallowed extension without collapsing", () => {
  render(<App />);

  pickFile("huge.csv", MAX_UPLOAD_BYTES + 1);
  expect(screen.getByRole("alert")).toHaveTextContent("The file is larger than 100 MB.");
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "false");
  expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();

  pickFile("photo.png", 100);
  expect(screen.getByRole("alert")).toHaveTextContent("This file type is not supported.");
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "false");
});

test("an accepted file collapses the zone and shows the ten card titles", () => {
  render(<App />);
  pickFile("trades.csv", 20);

  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "true");
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Replace file");
  const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
  expect(titles).toEqual(CARD_TITLES);
});

test("the metric selector updates only the ranking card", () => {
  render(<App />);
  pickFile("trades.csv", 20);

  const ranking = screen.getByTestId("card-ranking");
  fireEvent.change(within(ranking).getByRole("combobox"), { target: { value: "PnL" } });

  expect(ranking).toHaveTextContent("42");
  expect(ranking).not.toHaveTextContent("500");
  expect(screen.getByTestId("card-preview")).toHaveTextContent("Client_010");
  expect(screen.getByTestId("card-grouping")).toHaveTextContent("USA");
  expect(screen.getByTestId("card-timeseries")).toHaveTextContent("day");
});

test("replace resets the ranking selector", () => {
  render(<App />);
  pickFile("trades.csv", 20);
  const ranking = screen.getByTestId("card-ranking");
  fireEvent.change(within(ranking).getByRole("combobox"), { target: { value: "PnL" } });

  pickFile("other.csv", 20);

  expect(within(screen.getByTestId("card-ranking")).getByRole("combobox")).toHaveValue("Quantity");
  expect(screen.getByTestId("card-ranking")).toHaveTextContent("500");
});

test("the unavailable fixture renders the red message", () => {
  render(<App />);
  pickFile("trades.csv", 20);
  const insights = screen.getByTestId("card-insights");
  expect(insights).toHaveAttribute("data-status", "unavailable");
  expect(insights).toHaveTextContent(
    "There is no date column, no empty values, and no categorical column to describe.",
  );
});

test("language switch translates card titles and the red sentence", () => {
  render(<App />);
  pickFile("trades.csv", 20);
  fireEvent.click(screen.getByRole("button", { name: "RU" }));

  expect(screen.getByRole("heading", { name: "Просмотр" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Инсайты" })).toBeInTheDocument();
  expect(screen.getByTestId("card-insights")).toHaveTextContent(
    "Нет колонки с датой, пустых значений и категориальной колонки, которые можно описать.",
  );
  expect(screen.getByTestId("upload-button")).toHaveTextContent("Заменить файл");
});
