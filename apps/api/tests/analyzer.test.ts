import { afterEach, describe, expect, it } from "vitest";
import { runDocumentWorkflow } from "../src/analyzer";

describe("analyzer provider errors", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("rejects when OpenAI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(runDocumentWorkflow(`
      Services Agreement dated April 25th, 2022 between AppDevShop LLC and Sebastian Gomez.
      The agreement covers software development services and delivery obligations.
    `)).rejects.toMatchObject({ code: "missing_api_key" });
  });
});
