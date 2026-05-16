import { type DragEvent, useState } from "react";
import type { AnalyzeResponse } from "@docmind/shared";
import { allowedMimeTypes, maxUploadBytes } from "@docmind/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const acceptedFormats = ["PDF", "XLSX", "TXT", "MD"];

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  function onFileChange(nextFile: File | undefined) {
    setResult(null);
    setError("");

    if (!nextFile) {
      setFile(null);
      return;
    }

    const allowedExtension = /\.(pdf|xlsx|xls|txt|md)$/i.test(nextFile.name);
    if (!allowedMimeTypes.includes(nextFile.type as never) && !allowedExtension) {
      setFile(null);
      setError("Upload a PDF, XLSX, TXT, or MD file.");
      return;
    }

    if (nextFile.size > maxUploadBytes) {
      setFile(null);
      setError("File must be 10MB or smaller.");
      return;
    }

    setFile(nextFile);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    onFileChange(event.dataTransfer.files[0]);
  }

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const body = new FormData();
      body.append("document", file);

      const response = await fetch(`${apiBaseUrl}/api/documents/summarize`, {
        method: "POST",
        body
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to analyze document.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze document.");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setFile(null);
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12">
      <section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <header className="lg:sticky lg:top-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">LangGraph document analysis</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">DocMind</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            Upload a common document and get a clean summary, key ideas, important details, and conclusion from the local API.
          </p>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Supported file types">
            {acceptedFormats.map((format) => (
              <span key={format} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {format}
              </span>
            ))}
          </div>
        </header>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <label
              className={`flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
                dragActive ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-slate-50 hover:border-cyan-500"
              }`}
              htmlFor="document"
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
            >
              <span className="text-lg font-semibold text-slate-900">Drop your document here</span>
              <span className="mt-2 text-sm text-slate-600">or choose a file from your computer</span>
              <span className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">PDF, XLSX, TXT, MD up to 10MB</span>
              <input
                id="document"
                className="sr-only"
                type="file"
                accept=".pdf,.xlsx,.xls,.txt,.md"
                onChange={(event) => onFileChange(event.target.files?.[0])}
              />
            </label>

            {file && (
              <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                <dl className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">Size</dt>
                    <dd>{formatBytes(file.size)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Type</dt>
                    <dd>{file.type || file.name.split(".").pop()?.toUpperCase() || "Unknown"}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-md bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!file || loading}
                onClick={analyze}
                type="button"
              >
                {loading ? "Analyzing document..." : "Analyze document"}
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || (!file && !result && !error)}
                onClick={clear}
                type="button"
              >
                Clear
              </button>
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
              {error}
            </div>
          )}

          {result && (
            <article className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-2xl font-semibold text-slate-950">Analysis result</h2>
              <ResultSection title="Summary" items={[result.summary]} />
              <ResultSection title="Key ideas" items={result.keyIdeas} />
              <ResultSection title="Important details" items={result.importantDetails} />
              <ResultSection title="Conclusion" items={[result.conclusion]} />
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

function ResultSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>No items found.</li>}
      </ul>
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
