import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import { MAX_UPLOAD_BYTES } from "../upload/validateFile";
import UploadZone from "./UploadZone";

afterEach(() => {
  cleanup();
});

const messages = {
  file_too_large: "The file is larger than 100 MB.",
  unsupported_format: "This file type is not supported.",
};

function renderZone(collapsed) {
  const onAccepted = vi.fn();
  render(
    <UploadZone
      collapsed={collapsed}
      actionLabel="Upload file"
      replaceLabel="Replace file"
      messages={messages}
      onAccepted={onAccepted}
    />,
  );
  return { onAccepted };
}

function fileWithSize(name, size, type) {
  const file = new File(["x"], name, { type: type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function pickFile(file) {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [file] } });
}

test("a small csv is accepted and shows no alert", () => {
  const { onAccepted } = renderZone(false);
  const file = new File(["x"], "notes.csv", { type: "text/csv" });

  expect(screen.getByTestId("upload-button")).toHaveTextContent("Upload file");
  pickFile(file);

  expect(onAccepted).toHaveBeenCalledTimes(1);
  expect(onAccepted).toHaveBeenCalledWith(file);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a png shows the unsupported message and stays expanded", () => {
  const { onAccepted } = renderZone(false);

  pickFile(new File(["x"], "notes.png", { type: "image/png" }));

  expect(screen.getByRole("alert")).toHaveTextContent(messages.unsupported_format);
  expect(onAccepted).not.toHaveBeenCalled();
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "false");
});

test("a csv over 100MB shows the too-large message and is not accepted", () => {
  const { onAccepted } = renderZone(false);
  const file = fileWithSize("notes.csv", MAX_UPLOAD_BYTES + 1, "text/csv");

  pickFile(file);

  expect(screen.getByRole("alert")).toHaveTextContent(messages.file_too_large);
  expect(onAccepted).not.toHaveBeenCalled();
});

test("collapsed zone shows Replace file", () => {
  renderZone(true);

  expect(screen.getByTestId("upload-button")).toHaveTextContent("Replace file");
  expect(screen.getByTestId("upload-zone")).toHaveAttribute("data-collapsed", "true");
});

test("dropping a small csv on the zone accepts it", () => {
  const { onAccepted } = renderZone(false);
  const file = new File(["x"], "notes.csv", { type: "text/csv" });

  fireEvent.drop(screen.getByTestId("upload-zone"), {
    dataTransfer: { files: [file] },
  });

  expect(onAccepted).toHaveBeenCalledTimes(1);
  expect(onAccepted).toHaveBeenCalledWith(file);
});

test("marks the zone while a file is dragged over it", () => {
  const { onAccepted } = renderZone(false);
  const zone = screen.getByTestId("upload-zone");
  const file = new File(["x"], "notes.csv", { type: "text/csv" });

  expect(zone).toHaveAttribute("data-dragging", "false");
  fireEvent.dragEnter(zone);
  expect(zone).toHaveAttribute("data-dragging", "true");
  fireEvent.dragLeave(zone);
  expect(zone).toHaveAttribute("data-dragging", "false");

  fireEvent.dragEnter(zone);
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
  expect(zone).toHaveAttribute("data-dragging", "false");
  expect(onAccepted).toHaveBeenCalledWith(file);
});
