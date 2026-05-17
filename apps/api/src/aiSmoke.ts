import { classifyProviderError, logProviderError, missingOpenAIKeyError } from "./providerErrors.js";
import { createOpenAIChatModel } from "./openaiClient.js";

export async function runOpenAISmokeTest() {
  if (!process.env.OPENAI_API_KEY) {
    throw missingOpenAIKeyError();
  }

  try {
    const model = createOpenAIChatModel();

    await model.invoke([{ role: "user", content: "Reply only with OK" }]);
  } catch (error) {
    const providerError = classifyProviderError(error);
    logProviderError(providerError);
    throw providerError;
  }
}
