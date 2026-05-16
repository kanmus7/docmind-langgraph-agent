import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";

describe("api", () => {
  it("returns health status", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("requires a document upload", async () => {
    const res = await request(createApp()).post("/api/documents/summarize");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Document file is required.");
  });

  it("summarizes a text document with injected workflow", async () => {
    const summarizeDocument = vi.fn(async () => ({
      summary: "Short summary",
      keyIdeas: ["Idea"],
      importantDetails: ["Detail"],
      conclusion: "Conclusion",
      warnings: []
    }));

    const res = await request(createApp())
      .post("/api/documents/summarize")
      .attach("document", Buffer.from("DocMind extracts concise ideas."), {
        filename: "notes.txt",
        contentType: "text/plain"
      });

    expect(res.status).toBe(200);
    expect(res.body.summary).toContain("DocMind");
  });

  it("uses the injected workflow for endpoint integration tests", async () => {
    const summarizeDocument = vi.fn(async () => ({
      summary: "Mocked summary",
      keyIdeas: ["Mocked idea"],
      importantDetails: ["Mocked detail"],
      conclusion: "Mocked conclusion",
      warnings: []
    }));

    const res = await request(createApp({ summarizeDocument }))
      .post("/api/documents/summarize")
      .attach("document", Buffer.from("DocMind extracts concise ideas."), {
        filename: "notes.md",
        contentType: "text/markdown"
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      summary: "Mocked summary",
      keyIdeas: ["Mocked idea"],
      importantDetails: ["Mocked detail"],
      conclusion: "Mocked conclusion",
      warnings: []
    });
    expect(summarizeDocument).toHaveBeenCalledWith("DocMind extracts concise ideas.");
  });
});
