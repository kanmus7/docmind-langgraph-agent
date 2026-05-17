import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3001");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

  it("renders API warnings when present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        summary: "A short summary.",
        keyIdeas: ["First idea"],
        importantDetails: [],
        conclusion: "Final conclusion.",
        warnings: ["OPENAI_API_KEY is not set; fallback analysis was used."]
      })
    } as Response);

    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze document" }));

    expect(await screen.findByText("Warnings")).toBeInTheDocument();
    expect(screen.getByText("OPENAI_API_KEY is not set; fallback analysis was used.")).toBeInTheDocument();
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

  it("renders AI unavailable state for classified provider errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: {
          code: "insufficient_quota",
          message: "AI analysis is unavailable right now. The OpenAI project has insufficient quota.",
          action: "Check Render OPENAI_API_KEY, OpenAI billing/quota, selected model access, and redeploy the service."
        }
      })
    } as Response);

    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze document" }));

    expect(await screen.findByRole("heading", { name: "AI analysis unavailable" })).toBeInTheDocument();
    expect(screen.getByText("AI analysis is unavailable right now.")).toBeInTheDocument();
    expect(screen.getByText("Check Render OPENAI_API_KEY, OpenAI billing/quota, selected model access, and redeploy the service.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Analysis result" })).not.toBeInTheDocument();
  });

  it("renders a configuration error when the API URL is missing", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze document" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("API URL is not configured.");
  });

  it("validates unsupported file types", async () => {
    render(<App />);

    const input = screen.getByLabelText(/drop your document/i);
    const file = new File(["bad"], "bad.exe", { type: "application/octet-stream" });
    await userEvent.upload(input, file, { applyAccept: false });

    expect(screen.getByRole("alert")).toHaveTextContent("Upload a PDF, XLSX, TXT, or MD file.");
  });
});
