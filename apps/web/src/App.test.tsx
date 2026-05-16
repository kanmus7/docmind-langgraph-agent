import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the upload screen", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "DocMind" })).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("XLSX")).toBeInTheDocument();
    expect(screen.getByText("TXT")).toBeInTheDocument();
    expect(screen.getByText("MD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze document" })).toBeDisabled();
  });

  it("shows selected file name", async () => {
    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    const file = new File(["hello"], "notes.md", { type: "text/markdown" });
    await userEvent.upload(input, file);

    expect(screen.getByText("notes.md")).toBeInTheDocument();
    expect(screen.getByText("5 B")).toBeInTheDocument();
    expect(screen.getByText("text/markdown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze document" })).toBeEnabled();
  });

  it("renders result sections after a successful API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        summary: "A short summary.",
        keyIdeas: ["First idea", "Second idea"],
        importantDetails: ["Important detail"],
        conclusion: "Final conclusion.",
        warnings: []
      })
    } as Response);

    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze document" }));

    expect(await screen.findByRole("heading", { name: "Analysis result" })).toBeInTheDocument();
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Key ideas")).toBeInTheDocument();
    expect(screen.getByText("Important details")).toBeInTheDocument();
    expect(screen.getByText("Conclusion")).toBeInTheDocument();
    expect(screen.getByText("A short summary.")).toBeInTheDocument();
  });

  it("renders an API error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Backend failed." })
    } as Response);

    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze document" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Backend failed.");
  });

  it("validates unsupported file types", async () => {
    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    const file = new File(["bad"], "bad.exe", { type: "application/octet-stream" });
    await userEvent.upload(input, file, { applyAccept: false });

    expect(screen.getByRole("alert")).toHaveTextContent("Upload a PDF, XLSX, TXT, or MD file.");
  });
});
