type ProjectFile = { code: string };
type RequestBody = { prompt?: string; files?: Record<string, ProjectFile> };

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

const reply = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event: { httpMethod: string; body?: string | null }) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return reply(503, { error: "AI is not configured" });

  let body: RequestBody;
  try { body = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Invalid JSON" }); }
  const prompt = body.prompt?.trim();
  const files = body.files;
  if (!prompt || prompt.length > 1500 || !files) return reply(400, { error: "Invalid request" });
  const serialized = JSON.stringify(files);
  if (serialized.length > 90000) return reply(413, { error: "Project is too large" });

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
    if (!upstream.ok) return reply(502, { error: "Model request failed" });
    const payload = await upstream.json() as any;
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    if (!parsed.files || !parsed.summary) throw new Error("Invalid model output");
    return reply(200, { files: parsed.files, summary: parsed.summary, mode: "ai" });
  } catch {
    return reply(500, { error: "Generation failed" });
  }
};
