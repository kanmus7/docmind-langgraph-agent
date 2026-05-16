import { afterEach, describe, expect, it } from "vitest";
import { runDocumentWorkflow } from "../src/analyzer";

describe("analyzer fallback", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("returns useful structured fallback output when OpenAI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await runDocumentWorkflow(`
      Services Agreement dated April 25th, 2022 between AppDevShop LLC and Sebastian Gomez.
      The agreement covers software development services and delivery obligations.
      Payment terms require invoices to be paid within 15 days.
      Confidential information must be protected by both parties.
      The provider must deliver agreed work according to the project scope.
    `);

    expect(result.keyIdeas.length).toBeGreaterThan(1);
    expect(result.importantDetails.length).toBeGreaterThan(0);
    expect(result.conclusion).not.toBe("Fallback analysis used.");
    expect(result.warnings[0]).toContain("OPENAI_API_KEY");
  });
});
