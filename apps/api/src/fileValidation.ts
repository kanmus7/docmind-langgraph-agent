import path from "node:path";
import { z } from "zod";
import { allowedMimeTypes } from "@docmind/shared";
import { HttpError } from "./errors.js";
import type { Express } from "express";

const allowedExtensions = [".pdf", ".xlsx", ".xls", ".txt", ".md"];

export const uploadedFileSchema = z.object({
  originalname: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().positive()
});

export function validateDocumentFile(file: Pick<Express.Multer.File, "originalname" | "mimetype" | "size">) {
  const parsed = uploadedFileSchema.safeParse(file);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid document upload.");
  }

  const extension = path.extname(parsed.data.originalname).toLowerCase();
  const hasAllowedType = allowedMimeTypes.includes(parsed.data.mimetype as never);
  const hasAllowedExtension = allowedExtensions.includes(extension);

  if (!hasAllowedType && !hasAllowedExtension) {
    throw new HttpError(400, "Unsupported file type.");
  }
}
