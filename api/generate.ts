type ProjectFile = { code: string };
type RequestBody = { prompt?: string; files?: Record<string, ProjectFile> };

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are Builder, an expert product engineer inside an AI app studio. Modify the supplied Sandpack React project to fulfill the user's request.
Return ONLY valid JSON with this exact shape: {"summary":"short user-facing summary","files":{"/App.js":{"code":"complete file"},"/styles.css":{"code":"complete file"},"/package.json":{"code":"complete JSON string"}}}.
Rules:
- Return complete contents for every supplied file, including unchanged files.
- The app must run in Sandpack's React template without a backend.
- Preserve existing working features unless the user asks to remove them.
- Use JavaScript, not TypeScript. Import CSS as ./styles.css.
- Keep dependencies minimal. Browser localStorage is allowed.
- Make the result polished, responsive, and genuinely interactive.
- Never use markdown fences or explanatory text outside the JSON.`;

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return response.status(503).json({ error: "AI is not configured" });

  const body = request.body as RequestBody;
  const prompt = body?.prompt?.trim();
  const files = body?.files;
  if (!prompt || prompt.length > 1500 || !files) return response.status(400).json({ error: "Invalid request" });
  const serialized = JSON.stringify(files);
  if (serialized.length > 90000) return response.status(413).json({ error: "Project is too large" });

  try {
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Current project files:\n${serialized}\n\nUser request:\n${prompt}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 7000,
        temperature: 0.2,
      }),
    });
    if (!upstream.ok) return response.status(502).json({ error: "Model request failed" });
    const payload = await upstream.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    if (!parsed.files || !parsed.summary) throw new Error("Invalid model output");
    return response.status(200).json({ files: parsed.files, summary: parsed.summary, mode: "ai" });
  } catch {
    return response.status(500).json({ error: "Generation failed" });
  }
}
