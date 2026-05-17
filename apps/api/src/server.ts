import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not configured");
}

createApp().listen(port, () => {
  console.log(`DocMind API listening on http://localhost:${port}`);
});
