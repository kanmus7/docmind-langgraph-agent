import cors from "cors";
import express from "express";
import multer from "multer";
import { maxUploadBytes, type DocMindAnalysis } from "@docmind/shared";
import { runDocumentWorkflow } from "./analyzer.js";
import { HttpError } from "./errors.js";
import { validateDocumentFile } from "./fileValidation.js";
import { extractText } from "./parser.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes }
});

type AppOptions = {
  summarizeDocument?: (rawText: string) => Promise<DocMindAnalysis>;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const summarizeDocument = options.summarizeDocument ?? runDocumentWorkflow;

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/documents/summarize", upload.single("document"), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, "Document file is required.");
      }

      validateDocumentFile(req.file);

      const text = await extractText(req.file);
      if (!text.trim()) {
        throw new HttpError(400, "No readable text found in document.");
      }

      const analysis = await summarizeDocument(text);
      return res.json(analysis);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File exceeds 10MB limit." });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: "Unable to summarize document." });
  });

  return app;
}
