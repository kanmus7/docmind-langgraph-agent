import { describe, expect, it } from "vitest";
import { maxUploadBytes } from "./index";

describe("shared constants", () => {
  it("sets a 10MB upload limit", () => {
    expect(maxUploadBytes).toBe(10 * 1024 * 1024);
  });
});
