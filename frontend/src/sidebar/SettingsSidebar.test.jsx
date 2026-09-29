import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, test } from "vitest";
import "../i18n";
import { setLanguage } from "../i18n";
import SettingsSidebar from "./SettingsSidebar";

beforeEach(() => {
  cleanup();
  setLanguage("en");
});

function Harness({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <SettingsSidebar
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      {children}
    </SettingsSidebar>
  );
}

test("names the tab Data settings", () => {
  render(<Harness />);

  expect(screen.getByRole("button", { name: "Data settings" })).toBe(
    screen.getByTestId("settings-tab"),
  );
});

test("opens the panel from the tab", () => {
  render(<Harness />);

  expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId("settings-tab"));
  expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
});

test("closes the panel from the scrim", () => {
  render(<Harness />);

  fireEvent.click(screen.getByTestId("settings-tab"));
  fireEvent.click(screen.getByTestId("settings-scrim"));
  expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
});

test("keeps the panel open when the click is inside it", () => {
  render(
    <Harness>
      <button type="button">Apply</button>
    </Harness>,
  );

  fireEvent.click(screen.getByTestId("settings-tab"));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
});

test("closes on Escape and returns focus to the tab", () => {
  render(<Harness />);

  const tab = screen.getByTestId("settings-tab");
  fireEvent.click(tab);
  fireEvent.keyDown(document, { key: "Escape" });

  expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
  expect(document.activeElement).toBe(tab);
});

test("ignores Escape while the panel is closed", () => {
  render(<Harness />);

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
  expect(screen.queryByTestId("settings-scrim")).not.toBeInTheDocument();
});

test("names the tab in Russian", () => {
  setLanguage("ru");
  render(<Harness />);

  expect(screen.getByRole("button", { name: "Настройки данных" })).toBe(
    screen.getByTestId("settings-tab"),
  );
  setLanguage("en");
});

test("renders children inside the scroll container", () => {
  render(
    <Harness>
      <button type="button">Apply</button>
    </Harness>,
  );

  fireEvent.click(screen.getByTestId("settings-tab"));
  expect(screen.getByTestId("settings-scroll")).toContainElement(
    screen.getByRole("button", { name: "Apply" }),
  );
});
