import { StateGraph, Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { DocMindAnalysis } from "@docmind/shared";
import { classifyProviderError, logProviderError, missingOpenAIKeyError } from "./providerErrors.js";
import { createOpenAIChatModel } from "./openaiClient.js";

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

const analysisInputLimit = 12000;

export async function runDocumentWorkflow(rawText: string): Promise<DocMindAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw missingOpenAIKeyError();
  }

  const model = createOpenAIChatModel();
  const analysisModel = model.withStructuredOutput(finalResponseSchema);

  const graph = new StateGraph(GraphState)
    .addNode("normalizeDocumentText", async (state) => ({
      normalizedText: state.rawText.replace(/\s+/g, " ").trim(),
      warnings: state.rawText.length > analysisInputLimit ? ["Document was truncated for LLM processing."] : []
    }))
    .addNode("summarizeDocument", async (state) => {
      const result = await analysisModel.invoke([
        {
          role: "system",
          content: [
            "Analyze the document and return only structured JSON matching the requested schema.",
            "summary: 2 to 4 concise sentences.",
            "keyIdeas: 3 to 7 short, clear bullet-style ideas.",
            "importantDetails: concrete facts, decisions, dates, numbers, obligations, constraints, or notable terms.",
            "conclusion: one short practical conclusion.",
            "warnings: preserve any existing processing warnings if relevant; otherwise return an empty array."
          ].join(" ")
        },
        {
          role: "user",
          content: state.normalizedText.slice(0, analysisInputLimit)
        }
      ]);

      return {
        summary: result.summary,
        keyIdeas: result.keyIdeas,
        importantDetails: result.importantDetails,
        conclusion: result.conclusion,
        warnings: [...(state.warnings ?? []), ...(result.warnings ?? [])]
      };
    })
    .addNode("extractKeyIdeas", async (state) => ({ keyIdeas: state.keyIdeas }))
    .addNode("extractImportantDetails", async (state) => ({ importantDetails: state.importantDetails }))
    .addNode("generateConclusion", async (state) => ({ conclusion: state.conclusion }))
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
    const providerError = classifyProviderError(error);
    logProviderError(providerError);
    throw providerError;
  }
}
