type ProjectFile = { code: string };
type RequestBody = { prompt?: string; files?: Record<string, ProjectFile> };

const SYSTEM_PROMPT = `You are Builder, an expert product engineer inside an AI app studio. Modify the supplied Sandpack React project to fulfill the user's request.
Return ONLY valid JSON with this exact shape: {"summary":"short user-facing summary","edits":[{"file":"/App.js","search":"exact existing text","replace":"new text"}]}.
Rules:
- Make small, targeted search-and-replace edits. Include only files that need changes.
- Every search string must occur exactly once in its file. Preserve surrounding code.
- When rebuilding most of a file, set search to the exact sentinel __REPLACE_ALL__ and put the complete new file in replace. Never copy the old full file into search.
- You may use several edits; they are applied in order.
- Keep a full rebuild concise: App.js under 140 lines and styles.css under 180 lines.
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
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Current project files:\n${serialized}\n\nUser request:\n${prompt}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4200,
        temperature: 0.2,
      }),
    });
    if (!upstream.ok) {
      console.error("DeepSeek request failed", { status: upstream.status });
      return reply(502, { error: "Model request failed", providerStatus: upstream.status });
    }
    const payload = await upstream.json() as any;
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    if (!Array.isArray(parsed.edits) || !parsed.summary) throw new Error("Invalid model output");
    const nextFiles = JSON.parse(JSON.stringify(files)) as Record<string, ProjectFile>;
    for (const edit of parsed.edits) {
      const target = nextFiles[edit.file];
      if (!target || typeof edit.search !== "string" || typeof edit.replace !== "string") throw new Error("Invalid edit");
      if (edit.search === "__REPLACE_ALL__") {
        target.code = edit.replace;
        continue;
      }
      const first = target.code.indexOf(edit.search);
      if (first < 0 || first !== target.code.lastIndexOf(edit.search)) throw new Error("Ambiguous edit");
      target.code = target.code.slice(0, first) + edit.replace + target.code.slice(first + edit.search.length);
    }
    return reply(200, { files: nextFiles, summary: parsed.summary, mode: "ai" });
  } catch (error) {
    console.error("Generation failed", error);
    return reply(500, { error: "Generation failed" });
  }
};
