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

  it("classifies nested model request errors from wrapped provider errors", () => {
    const error = classifyProviderError({
      message: "LangChain call failed",
      cause: {
        status: 400,
        error: {
          code: "unsupported_parameter",
          type: "invalid_request_error",
          message: "Unsupported parameter: 'temperature' is not supported with this model."
        }
      }
    });

    expect(error.code).toBe("model_configuration_error");
  });

  it("classifies nested model access errors", () => {
    const error = classifyProviderError({
      cause: {
        status: 404,
        error: {
          code: "model_not_found",
          message: "The model `gpt-test` does not exist or you do not have access to it."
        }
      }
    });

    expect(error.code).toBe("model_not_found");
  });
});
