import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { DocMindAnalysis } from "@docmind/shared";

const arraySchema = z.object({ items: z.array(z.string()) });
const textSchema = z.object({ text: z.string() });
const defaultOpenAIModel = "gpt-5.5";

export const finalResponseSchema = z.object({
  summary: z.string(),
  keyIdeas: z.array(z.string()),
  importantDetails: z.array(z.string()),
  conclusion: z.string(),
  warnings: z.array(z.string())
});

const GraphState = Annotation.Root({
  rawText: Annotation<string>(),
  normalizedText: Annotation<string>(),
  summary: Annotation<string>(),
  keyIdeas: Annotation<string[]>(),
  importantDetails: Annotation<string[]>(),
  conclusion: Annotation<string>(),
  warnings: Annotation<string[]>()
});

export async function runDocumentWorkflow(rawText: string): Promise<DocMindAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackAnalysis(rawText);
  }

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? defaultOpenAIModel,
    temperature: 0
  });

  const summaryModel = model.withStructuredOutput(textSchema);
  const listModel = model.withStructuredOutput(arraySchema);

  const graph = new StateGraph(GraphState)
    .addNode("normalizeDocumentText", async (state) => ({
      normalizedText: state.rawText.replace(/\s+/g, " ").trim(),
      warnings: state.rawText.length > 20000 ? ["Document was truncated for LLM processing."] : []
    }))
    .addNode("summarizeDocument", async (state) => {
      const result = await summaryModel.invoke([
        {
          role: "system",
          content: "Create a concise document summary. Return JSON with a text field only."
        },
        {
          role: "user",
          content: state.normalizedText.slice(0, 20000)
        }
      ]);

      return { summary: result.text };
    })
    .addNode("extractKeyIdeas", async (state) => {
      const result = await listModel.invoke([
        {
          role: "system",
          content: "Extract 3 to 7 key ideas from the document. Return JSON with an items array only."
        },
        {
          role: "user",
          content: state.normalizedText.slice(0, 20000)
        }
      ]);

      return { keyIdeas: result.items };
    })
    .addNode("extractImportantDetails", async (state) => {
      const result = await listModel.invoke([
        {
          role: "system",
          content: "Extract important concrete details, facts, decisions, dates, numbers, or constraints. Return JSON with an items array only."
        },
        {
          role: "user",
          content: state.normalizedText.slice(0, 20000)
        }
      ]);

      return { importantDetails: result.items };
    })
    .addNode("generateConclusion", async (state) => {
      const result = await summaryModel.invoke([
        {
          role: "system",
          content: "Write a short practical conclusion from the document. Return JSON with a text field only."
        },
        {
          role: "user",
          content: `Summary: ${state.summary}\nKey ideas: ${state.keyIdeas.join("; ")}\nDetails: ${state.importantDetails.join("; ")}`
        }
      ]);

      return { conclusion: result.text };
    })
    .addNode("formatFinalResponse", async (state) => finalResponseSchema.parse({
      summary: state.summary,
      keyIdeas: state.keyIdeas,
      importantDetails: state.importantDetails,
      conclusion: state.conclusion,
      warnings: state.warnings ?? []
    }))
    .addEdge("__start__", "normalizeDocumentText")
    .addEdge("normalizeDocumentText", "summarizeDocument")
    .addEdge("summarizeDocument", "extractKeyIdeas")
    .addEdge("extractKeyIdeas", "extractImportantDetails")
    .addEdge("extractImportantDetails", "generateConclusion")
    .addEdge("generateConclusion", "formatFinalResponse")
    .addEdge("formatFinalResponse", "__end__")
    .compile();

  try {
    const result = await graph.invoke({ rawText });
    return finalResponseSchema.parse(result);
  } catch (error) {
    const warning = getOpenAIWarning(error);
    console.error(warning);
    return fallbackAnalysis(rawText, warning);
  }
}

function fallbackAnalysis(text: string, warning?: string): DocMindAnalysis {
  const compact = text.replace(/\s+/g, " ").trim();
  const sentences = splitSentences(compact);
  const summary = sentences.slice(0, 2).join(" ") || "No readable text found.";
  const keyIdeas = buildKeyIdeas(sentences, compact);
  const importantDetails = extractImportantDetailsFallback(compact);

  return {
    summary,
    keyIdeas,
    importantDetails,
    conclusion: compact
      ? "Review the extracted summary and details as a first-pass overview; full AI analysis is unavailable for this request."
      : "No readable content was available to analyze.",
    warnings: warning ? [warning] : ["OPENAI_API_KEY is not set; fallback analysis was used."]
  };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20)
    .map((sentence) => truncate(sentence, 180));
}

function buildKeyIdeas(sentences: string[], text: string): string[] {
  if (!text.trim()) return ["No readable text extracted."];

  const candidates = sentences
    .filter((sentence) => !/^\d+$/.test(sentence))
    .slice(0, 8);

  const ideas = unique([
    ...candidates.slice(0, 5),
    ...extractLabeledLines(text)
  ]).slice(0, 5);

  return ideas.length > 0 ? ideas : [truncate(text, 180)];
}

function extractImportantDetailsFallback(text: string): string[] {
  const details = [
    ...matchAll(text, /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi),
    ...matchAll(text, /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g),
    ...matchAll(text, /\b[A-Z][A-Za-z0-9&.,'\-\s]+(?:LLC|Inc\.?|Ltd\.?|S\.A\.S\.?|Corporation|Company)\b/g),
    ...matchAll(text, /\b(?:USD\s*)?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|COP|EUR)?\b/g)
  ];

  return unique(details.map((detail) => truncate(detail, 140))).slice(0, 8);
}

function extractLabeledLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /(?:agreement|service|term|payment|confidential|deliverable|effective|party|customer|provider)/i.test(line))
    .map((line) => truncate(line, 180));
}

function matchAll(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[0].trim());
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}...`;
}

function getOpenAIWarning(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("unauthorized") || lower.includes("401")) {
    return "OpenAI analysis failed: API key is missing, invalid, or not available to the Render service.";
  }

  if (lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient_quota") || lower.includes("429")) {
    return "OpenAI analysis failed: quota, billing, or rate limit issue.";
  }

  if (lower.includes("model") || lower.includes("404")) {
    return "OpenAI analysis failed: configured model is unavailable for this API key.";
  }

  return "OpenAI analysis failed; fallback analysis was used.";
}
