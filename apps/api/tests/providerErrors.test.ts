import { describe, expect, it } from "vitest";
import { classifyProviderError } from "../src/providerErrors";

describe("provider error classification", () => {
  it("classifies insufficient quota", () => {
    const error = classifyProviderError({ code: "insufficient_quota", status: 429 });

    expect(error.code).toBe("insufficient_quota");
    expect(error.toResponse().message).toContain("quota");
  });

  it("classifies rate limits", () => {
    const error = classifyProviderError({ status: 429, message: "Rate limit reached" });

    expect(error.code).toBe("rate_limited");
    expect(error.statusCode).toBe(429);
  });
});
