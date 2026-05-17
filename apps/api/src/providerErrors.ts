export type ProviderErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "insufficient_quota"
  | "rate_limited"
  | "billing_required"
  | "model_not_found"
  | "unknown_provider_error";

export type ProviderErrorBody = {
  code: ProviderErrorCode;
  message: string;
  action: string;
};

const providerAction = "Check Render OPENAI_API_KEY, OpenAI billing/quota, selected model access, and redeploy the service.";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly statusCode = 502,
    public readonly providerCode?: string,
    public readonly providerStatus?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }

  toResponse(): ProviderErrorBody {
    return {
      code: this.code,
      message: this.message,
      action: providerAction
    };
  }
}

export function missingOpenAIKeyError() {
  return new ProviderError(
    "missing_api_key",
    "AI analysis is unavailable right now. OPENAI_API_KEY is not configured.",
    503
  );
}

export function classifyProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;

  const status = readNumber(error, "status") ?? readNumber(error, "statusCode");
  const providerCode = readString(error, "code") ?? readNestedString(error, ["error", "code"]);
  const message = sanitizeMessage(error instanceof Error ? error.message : String(error));
  const lower = `${providerCode ?? ""} ${message}`.toLowerCase();

  if (status === 401 || lower.includes("invalid api key") || lower.includes("incorrect api key") || lower.includes("unauthorized")) {
    return new ProviderError("invalid_api_key", "AI analysis is unavailable right now. The OpenAI API key was rejected.", 502, providerCode, status);
  }

  if (lower.includes("insufficient_quota")) {
    return new ProviderError("insufficient_quota", "AI analysis is unavailable right now. The OpenAI project has insufficient quota.", 502, providerCode, status);
  }

  if (status === 429 || lower.includes("rate limit")) {
    return new ProviderError("rate_limited", "AI analysis is unavailable right now. The OpenAI API is rate limited.", 429, providerCode, status);
  }

  if (lower.includes("billing") || lower.includes("payment") || lower.includes("credits")) {
    return new ProviderError("billing_required", "AI analysis is unavailable right now. OpenAI billing or credits require attention.", 502, providerCode, status);
  }

  if (status === 404 || lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist") || lower.includes("not have access"))) {
    return new ProviderError("model_not_found", "AI analysis is unavailable right now. The configured OpenAI model is unavailable for this key.", 502, providerCode, status);
  }

  if (lower.includes("api key")) {
    return new ProviderError("invalid_api_key", "AI analysis is unavailable right now. The OpenAI API key is missing or invalid.", 502, providerCode, status);
  }

  return new ProviderError("unknown_provider_error", "AI analysis is unavailable right now. OpenAI returned an unexpected provider error.", 502, providerCode, status);
}

export function logProviderError(error: ProviderError) {
  console.error("OpenAI provider error", {
    name: error.name,
    statusCode: error.providerStatus,
    providerCode: error.providerCode,
    message: sanitizeMessage(error.message)
  });
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "number" ? field : undefined;
}

function readString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function readNestedString(value: unknown, path: string[]): string | undefined {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeMessage(message: string) {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}
