import cors from "cors";
import express from "express";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { maxUploadBytes, type DocMindAnalysis } from "@docmind/shared";
import { runDocumentWorkflow } from "./analyzer.js";
import { runOpenAISmokeTest } from "./aiSmoke.js";
import { HttpError } from "./errors.js";
import { ProviderError } from "./providerErrors.js";
import { validateDocumentFile } from "./fileValidation.js";
import { extractText } from "./parser.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes }
});

const defaultCorsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

type AppOptions = {
  summarizeDocument?: (rawText: string) => Promise<DocMindAnalysis>;
  smokeTest?: () => Promise<void>;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const summarizeDocument = options.summarizeDocument ?? runDocumentWorkflow;
  const smokeTest = options.smokeTest ?? runOpenAISmokeTest;

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? defaultCorsOrigins }));
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/health/config", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
      nodeEnv: process.env.NODE_ENV ?? "development"
    });
  });

  app.get("/api/ai/smoke-test", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await smokeTest();
      res.json({ status: "ok", provider: "openai" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents/summarize", upload.single("document"), async (req: Request, res: Response, next: NextFunction) => {
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

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File exceeds 10MB limit." });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error instanceof ProviderError) {
      return res.status(error.statusCode).json({ error: error.toResponse() });
    }

    console.error(error instanceof Error ? error.message : "Unknown API error");
    return res.status(500).json({ error: "Unable to summarize document." });
  });

  return app;
}
