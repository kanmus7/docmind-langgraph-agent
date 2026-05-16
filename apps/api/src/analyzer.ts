import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { DocMindAnalysis } from "@docmind/shared";

const arraySchema = z.object({ items: z.array(z.string()) });
const textSchema = z.object({ text: z.string() });

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
    model: "gpt-4o-mini",
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
    console.error(error instanceof Error ? error.message : "OpenAI analysis failed.");
    return fallbackAnalysis(rawText, "OpenAI analysis failed; fallback analysis was used.");
  }
}

function fallbackAnalysis(text: string, warning?: string): DocMindAnalysis {
  const compact = text.replace(/\s+/g, " ").trim();
  const preview = compact.slice(0, 280) || "No readable text found.";

  return {
    summary: preview,
    keyIdeas: compact ? [preview] : ["No readable text extracted."],
    importantDetails: [],
    conclusion: warning || process.env.NODE_ENV === "test"
      ? "Fallback analysis used."
      : "Set OPENAI_API_KEY to enable LangGraph/OpenAI analysis.",
    warnings: warning ? [warning] : ["OPENAI_API_KEY is not set; fallback analysis was used."]
  };
}
