import path from "node:path";
import pdfParse from "pdf-parse";
import xlsx from "xlsx";
import type { Express } from "express";

export async function extractText(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.mimetype === "application/pdf" || ext === ".pdf") {
    const result = await pdfParse(file.buffer);
    return result.text;
  }

  if (
    file.mimetype.includes("spreadsheet") ||
    file.mimetype === "application/vnd.ms-excel" ||
    [".xlsx", ".xls"].includes(ext)
  ) {
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    return workbook.SheetNames.map((name) => {
      const rows = xlsx.utils.sheet_to_csv(workbook.Sheets[name]);
      return `Sheet: ${name}\n${rows}`;
    }).join("\n\n");
  }

  return file.buffer.toString("utf8");
}
