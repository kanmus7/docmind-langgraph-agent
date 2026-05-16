export type DocMindAnalysis = {
  summary: string;
  keyIdeas: string[];
  importantDetails: string[];
  conclusion: string;
  warnings: string[];
};

export type AnalyzeResponse = {
  summary: string;
  keyIdeas: string[];
  importantDetails: string[];
  conclusion: string;
  warnings: string[];
};

export const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/markdown"
] as const;

export const maxUploadBytes = 10 * 1024 * 1024;
