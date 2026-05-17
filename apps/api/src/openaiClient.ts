import { ChatOpenAI } from "@langchain/openai";

const defaultOpenAIModel = "gpt-5.5";

export function createOpenAIChatModel() {
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? defaultOpenAIModel
  });
}
