import { ChatOpenAI } from "@langchain/openai";
import { classifyProviderError, logProviderError, missingOpenAIKeyError } from "./providerErrors.js";

const defaultOpenAIModel = "gpt-5.5";

export async function runOpenAISmokeTest() {
  if (!process.env.OPENAI_API_KEY) {
    throw missingOpenAIKeyError();
  }

  try {
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? defaultOpenAIModel,
      temperature: 0
    });

    await model.invoke([{ role: "user", content: "Reply only with OK" }]);
  } catch (error) {
    const providerError = classifyProviderError(error);
    logProviderError(providerError);
    throw providerError;
  }
}
