import { describe, expect, it } from "vitest";
import { validateDocumentFile } from "../src/fileValidation";

const baseFile = {
  originalname: "notes.txt",
  mimetype: "text/plain",
  size: 100
};

describe("validateDocumentFile", () => {
  it.each([
    ["document.pdf", "application/pdf"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["legacy.xls", "application/vnd.ms-excel"],
    ["notes.txt", "text/plain"],
    ["notes.md", "text/markdown"]
  ])("accepts %s", (originalname, mimetype) => {
    expect(() => validateDocumentFile({ ...baseFile, originalname, mimetype })).not.toThrow();
  });

  it("rejects unsupported file types", () => {
    expect(() =>
      validateDocumentFile({
        originalname: "virus.exe",
        mimetype: "application/octet-stream",
        size: 100
      })
    ).toThrow("Unsupported file type.");
  });
});
