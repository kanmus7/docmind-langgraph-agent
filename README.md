# DocMind

DocMind is a small real-world LangGraph experiment app. Users upload a common document and receive a structured analysis:

- Summary
- Key ideas
- Important details
- Conclusion
- Warnings, when applicable

Supported files: PDF, XLSX, TXT, MD. Files are limited to 10MB.

## Tech Stack

- Monorepo: npm workspaces
- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Workflow: LangGraph JS
- LLM: OpenAI via `OPENAI_API_KEY`
- Parsing: `pdf-parse`, `xlsx`, plain text reader
- Testing: Vitest, Supertest, React Testing Library
- Deployment: Render API + Vercel frontend

## Why LangGraph

LangGraph is used to make the document analysis flow explicit and easy to extend. Instead of one opaque LLM call, DocMind models the work as small deterministic nodes:

- normalize document text
- summarize
- extract key ideas
- extract important details
- generate conclusion
- format the final response

This keeps the MVP simple while leaving room for branching, retries, persistence, RAG, or background processing later.

## Workflow

```txt
Upload document
  -> parse file
  -> normalize text
  -> LangGraph nodes
       1. normalizeDocumentText
       2. summarizeDocument
       3. extractKeyIdeas
       4. extractImportantDetails
       5. generateConclusion
       6. formatFinalResponse
  -> final structured result
```

API response:

```json
{
  "summary": "string",
  "keyIdeas": ["string"],
  "importantDetails": ["string"],
  "conclusion": "string",
  "warnings": ["string"]
}
```

Provider error response:

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "AI analysis is unavailable right now.",
    "action": "Check Render OPENAI_API_KEY, OpenAI billing/quota, selected model access, and redeploy the service."
  }
}
```

## Environment Variables

Backend:

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.5
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

Frontend:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

Do not put `OPENAI_API_KEY` in frontend environment variables.

## Local Setup

```bash
npm install
npm run dev
```

Local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:3001`

Run separately:

```bash
npm run dev:web
npm run dev:api
```

## Tests

```bash
npm run test
```

## Build

```bash
npm run build
```

Optional typecheck/lint:

```bash
npm run lint
```

## Deployment

Production architecture:

```txt
User -> Frontend -> Render API -> OpenAI API
```

Production URLs:

- Backend Render URL: `https://docmind-api.onrender.com` (placeholder until Render service is live)
- Backend health check: `https://docmind-api.onrender.com/health`
- Frontend Vercel URL: `https://<frontend-url>` (placeholder until Vercel deploy is live)

### Render API

Create a Render Web Service:

- Name: `docmind-api`
- Runtime: Node
- Repository: `kanmus7/docmind-langgraph-agent`
- Branch: `main`
- Root Directory: repository root
- Build Command: `npm install && npm run build --workspace @docmind/api`
- Start Command: `npm run start --workspace @docmind/api`
- Health Check Path: `/health`
- Plan: free

You can also use the committed `render.yaml` Blueprint from the Render Dashboard.

Manual secret setup:

1. Open Render Dashboard.
2. Go to `docmind-api` -> Environment.
3. Add `OPENAI_API_KEY` as a secret environment variable.
4. Add `CORS_ORIGIN=https://<frontend-url>` after Vercel creates the frontend URL.

Render environment variables:

```bash
NODE_ENV=production
OPENAI_API_KEY=<set as secret in Render>
OPENAI_MODEL=gpt-5.5
CORS_ORIGIN=<frontend production URL>
```

Do not put `OPENAI_API_KEY` in frontend env vars or source code.

After each Render deploy, verify:

1. `GET https://docmind-api-aat4.onrender.com/health`
   - expected: `{ "status": "ok" }`
2. `GET https://docmind-api-aat4.onrender.com/health/config`
   - expected: `openAiConfigured: true`
   - this endpoint never returns the actual key
3. `GET https://docmind-api-aat4.onrender.com/api/ai/smoke-test`
   - expected: `{ "status": "ok", "provider": "openai" }`

If the smoke test fails:

- verify `OPENAI_API_KEY` in Render
- verify OpenAI billing/quota
- verify the key has access to `OPENAI_MODEL`
- redeploy Render after env var changes

### Frontend

Recommended: Vercel for the frontend, Render for the backend.

Vercel project settings:

- Root Directory: `apps/web`
- Build Command: `npm run build`
- Output Directory: `dist`

Set this frontend build env var:

```bash
VITE_API_BASE_URL=https://docmind-api.onrender.com
```

The frontend calls:

```txt
${VITE_API_BASE_URL}/api/documents/summarize
```

GitHub Pages deployment is disabled by default. Use Vercel for production frontend deploys.

## Future Improvements

- Auth
- Document history
- Vector search/RAG
- Background jobs
- Backend deployment
- Better Excel sheet previews
