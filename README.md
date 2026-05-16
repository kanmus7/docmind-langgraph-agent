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
- Deployment: Render API + Vercel/GitHub Pages frontend

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

## Environment Variables

Backend:

```bash
OPENAI_API_KEY=your_openai_api_key
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

URLs:

- Backend Render URL: `https://docmind-api.onrender.com` (placeholder until live)
- Backend health check: `https://docmind-api.onrender.com/health`
- Frontend Vercel/GitHub Pages URL: `https://your-frontend-url.example` (placeholder)

### Render API

Create a Render Web Service:

- Name: `docmind-api`
- Runtime: Node
- Repository: `kanmus7/docmind-langgraph-agent`
- Branch: `main`
- Root Directory: `apps/api`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Health Check Path: `/health`
- Plan: free

You can also use the committed `render.yaml` Blueprint from the Render Dashboard.

Render environment variables:

```bash
NODE_ENV=production
OPENAI_API_KEY=<set as secret in Render>
CORS_ORIGIN=<frontend production URL>
```

Do not put `OPENAI_API_KEY` in frontend env vars or source code.

### Frontend

Recommended: Vercel for the frontend, Render for the backend.

Set this frontend build env var:

```bash
VITE_API_BASE_URL=https://docmind-api.onrender.com
```

The frontend calls:

```txt
${VITE_API_BASE_URL}/api/documents/summarize
```

GitHub Pages deploys only the frontend via `.github/workflows/deploy-web.yml`.

## Future Improvements

- Auth
- Document history
- Vector search/RAG
- Background jobs
- Backend deployment
- Better Excel sheet previews
