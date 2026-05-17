import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { ProviderError } from "../src/providerErrors";

describe("api", () => {
  it("returns health status", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("allows local Vite origins", async () => {
    const res = await request(createApp())
      .get("/health")
      .set("Origin", "http://127.0.0.1:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
  });

  it("returns safe config health without leaking secrets", async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-secret";

    const res = await request(createApp()).get("/health/config");

    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      openAiConfigured: true,
      nodeEnv: process.env.NODE_ENV ?? "development"
    });
    expect(JSON.stringify(res.body)).not.toContain("sk-test-secret");
  });

  it("requires a document upload", async () => {
    const res = await request(createApp()).post("/api/documents/summarize");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Document file is required.");
  });

  it("returns classified provider errors without fake summaries", async () => {
    const summarizeDocument = vi.fn(async () => {
      throw new ProviderError("insufficient_quota", "AI analysis is unavailable right now. The OpenAI project has insufficient quota.", 502);
    });

    const res = await request(createApp({ summarizeDocument }))
      .post("/api/documents/summarize")
      .attach("document", Buffer.from("DocMind extracts concise ideas."), {
        filename: "notes.md",
        contentType: "text/markdown"
      });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: {
        code: "insufficient_quota",
        message: "AI analysis is unavailable right now. The OpenAI project has insufficient quota.",
        action: "Check Render OPENAI_API_KEY, OpenAI billing/quota, selected model access, and redeploy the service."
      }
    });
    expect(res.body.summary).toBeUndefined();
  });

  it("returns classified smoke test errors", async () => {
    const smokeTest = vi.fn(async () => {
      throw new ProviderError("rate_limited", "AI analysis is unavailable right now. The OpenAI API is rate limited.", 429);
    });

    const res = await request(createApp({ smokeTest })).get("/api/ai/smoke-test");

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("rate_limited");
  });

  it("returns smoke test success", async () => {
    const res = await request(createApp({ smokeTest: vi.fn(async () => undefined) })).get("/api/ai/smoke-test");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", provider: "openai" });
  });

  it("summarizes a text document with injected workflow", async () => {
    const summarizeDocument = vi.fn(async () => ({
      summary: "Short summary",
      keyIdeas: ["Idea"],
      importantDetails: ["Detail"],
      conclusion: "Conclusion",
      warnings: []
    }));

    const res = await request(createApp({ summarizeDocument }))
      .post("/api/documents/summarize")
      .attach("document", Buffer.from("DocMind extracts concise ideas."), {
        filename: "notes.txt",
        contentType: "text/plain"
      });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe("Short summary");
    expect(summarizeDocument).toHaveBeenCalledWith("DocMind extracts concise ideas.");
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
