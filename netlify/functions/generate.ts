import { parse } from "@babel/parser";

type ProjectFile = { code: string };
type RequestBody = { prompt?: string; files?: Record<string, ProjectFile>; repairError?: string; targetFile?: string };
type Operation = { type: "write_file" | "replace_text"; file: string; content: string; search?: string };

const SYSTEM_PROMPT = `You are Builder, an expert product engineer operating a browser-based React code workspace.
Return ONLY valid JSON: {"summary":"short user-facing summary","operations":[{"type":"write_file","file":"/App.js","content":"complete code"},{"type":"replace_text","file":"/styles.css","search":"exact unique text","content":"replacement"}]}.
Rules:
- Use write_file only for a new file or a substantial rebuild. Use replace_text for normal changes.
- Include only files that change. Never repeat unchanged files or old source in content.
- Each replace_text search must occur exactly once. Operations run in order.
- The project runs in Sandpack's React template. Use JavaScript + JSX, not TypeScript. Import ./styles.css.
- Preserve working features unless removal is requested. Keep dependencies minimal and never add a backend.
- For a full build keep App.js under 130 lines and styles.css under 160 lines. Prefer compact data-driven components.
- Make the result polished, responsive, accessible, and interactive. localStorage is allowed.
- Never use markdown fences or text outside the JSON.`;

const reply = (statusCode: number, body: unknown) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function applyOperations(files: Record<string, ProjectFile>, operations: Operation[]) {
  const next = JSON.parse(JSON.stringify(files)) as Record<string, ProjectFile>;
  for (const operation of operations) {
    if (!operation || typeof operation.file !== "string" || typeof operation.content !== "string") throw new Error("Invalid file operation");
    if (operation.type === "write_file") { next[operation.file] = { code: operation.content }; continue; }
    if (operation.type !== "replace_text" || typeof operation.search !== "string" || !next[operation.file]) throw new Error("Invalid replace operation");
    const source = next[operation.file].code;
    const first = source.indexOf(operation.search);
    if (first < 0 || first !== source.lastIndexOf(operation.search)) throw new Error(`Search text is missing or ambiguous in ${operation.file}`);
    next[operation.file].code = source.slice(0, first) + operation.content + source.slice(first + operation.search.length);
  }
  return next;
}

function validateProject(files: Record<string, ProjectFile>) {
  const app = files["/App.js"]?.code;
  if (!app) throw new Error("App.js is missing");
  parse(app, { sourceType: "module", plugins: ["jsx"] });
  const packageCode = files["/package.json"]?.code;
  if (packageCode) JSON.parse(packageCode);
}

async function requestOperations(apiKey: string, prompt: string, files: Record<string, ProjectFile>, repairError?: string, targetFile?: string) {
  const context = JSON.stringify(files);
  const scope = targetFile ? `\nYou may modify ONLY ${targetFile}. Return exactly one operation for that file. Keep it concise.` : "";
  const task = repairError
    ? `Repair the project after this validation error: ${repairError}\nMake the smallest reliable correction.${scope}\n\nProject files:\n${context}`
    : `Project files:\n${context}\n\nUser request:\n${prompt}${scope}`;
  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: task }],
      response_format: { type: "json_object" },
      max_tokens: repairError ? 2200 : targetFile === "/styles.css" ? 2800 : targetFile ? 3400 : 4400,
      temperature: 0.15,
    }),
  });
  if (!upstream.ok) throw new Error(`Model request failed (${upstream.status})`);
  const payload = await upstream.json() as any;
  if (payload.choices?.[0]?.finish_reason === "length") throw new Error("Model output was truncated");
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
  if (!Array.isArray(parsed.operations) || typeof parsed.summary !== "string") throw new Error("Invalid model response");
  return parsed as { summary: string; operations: Operation[] };
}

export const handler = async (event: { httpMethod: string; body?: string | null }) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return reply(503, { error: "AI is not configured" });

  let body: RequestBody;
  try { body = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Invalid JSON" }); }
  const prompt = body.prompt?.trim();
  const files = body.files;
  if (!prompt || prompt.length > 1500 || !files) return reply(400, { error: "Invalid request" });
  if (JSON.stringify(files).length > 90000) return reply(413, { error: "Project is too large" });

  if (!body.repairError && /^(开始(?:构建)?吧?|继续吧?|好的?|可以|行|go ahead|build it|continue)[。.!！ ]*$/i.test(prompt)) {
    return reply(200, { files, summary: "当前应用已经构建完成。请直接告诉我下一处需要修改的内容。", mode: "ai", changed: false });
  }

  try {
    const generated = await requestOperations(apiKey, prompt, files, body.repairError, body.targetFile);
    if (body.targetFile && generated.operations.some(operation => operation.file !== body.targetFile)) throw new Error("Model changed a file outside the requested scope");
    const nextFiles = applyOperations(files, generated.operations);
    try { validateProject(nextFiles); }
    catch (validationError) {
      const detail = validationError instanceof Error ? validationError.message : "Unknown validation error";
      return reply(422, { error: "Generated code did not compile", detail, files: nextFiles });
    }
    return reply(200, { files: nextFiles, summary: generated.summary, mode: "ai", changed: generated.operations.length > 0 });
  } catch (error) {
    console.error("Generation failed", error);
    return reply(500, { error: "Generation failed", detail: error instanceof Error ? error.message : "Unknown error" });
  }
};
