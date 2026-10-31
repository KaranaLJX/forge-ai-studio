import { useEffect, useMemo, useRef, useState } from "react";
import { SandpackCodeEditor, SandpackLayout, SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";
import { ArrowUp, Check, ChevronDown, Code2, Eye, History, Loader2, Plus, RotateCcw, Sparkles, WandSparkles, X } from "lucide-react";
import type { Message, ProjectFiles, StoredProject, Version } from "./types";
import { starterFiles } from "./starter";

const STORAGE_KEY = "forge-studio-project-v1";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const cloneFiles = (files: ProjectFiles): ProjectFiles => JSON.parse(JSON.stringify(files));
const welcome: Message = { id: "welcome", role: "assistant", agent: "lead", content: "Hi, I’m Nova, your build lead. Describe the app you want and I’ll coordinate the plan, code, and preview.", createdAt: Date.now() };

const examples = ["Build a calm travel budget planner", "Create a focused task board", "Switch the app to a violet theme"];

export default function App() {
  const [files, setFiles] = useState<ProjectFiles>(starterFiles);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState(0);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const stored: StoredProject = JSON.parse(raw);
      setFiles(stored.files); setMessages(stored.messages); setVersions(stored.versions);
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => {
    setSaved(false);
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, messages, versions, updatedAt: Date.now() }));
      setSaved(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [files, messages, versions]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, stage]);

  const versionLabel = useMemo(() => versions.length ? `Version ${versions.length}` : "Draft", [versions]);

  async function generate(text: string) {
    if (!text.trim() || building) return;
    const clean = text.trim();
    setPrompt(""); setBuilding(true); setStage(1);
    setMessages(prev => [...prev, { id: uid(), role: "user", content: clean, createdAt: Date.now() }]);
    await new Promise(r => setTimeout(r, 650)); setStage(2);
    await new Promise(r => setTimeout(r, 750)); setStage(3);
    let result: { files: ProjectFiles; summary: string; mode?: string };
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: clean, files }) });
      if (!response.ok) throw new Error("AI generation failed");
      result = await response.json();
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: "AI generation failed this time. Your current app is unchanged—please retry the request.", createdAt: Date.now() }]);
      setStage(0); setBuilding(false);
      return;
    }
    const nextVersion: Version = { id: uid(), number: versions.length + 1, prompt: clean, summary: result.summary, files: cloneFiles(result.files), createdAt: Date.now() };
    setFiles(result.files); setVersions(prev => [...prev, nextVersion]);
    setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: result.summary, createdAt: Date.now() }]);
    setStage(0); setBuilding(false);
  }

  function restore(version: Version) {
    const restored = cloneFiles(version.files);
    const newVersion: Version = { id: uid(), number: versions.length + 1, prompt: `Restore version ${version.number}`, summary: `Restored the project to Version ${version.number}.`, files: restored, createdAt: Date.now() };
    setFiles(restored); setVersions(prev => [...prev, newVersion]); setHistoryOpen(false);
    setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: newVersion.summary, createdAt: Date.now() }]);
  }

  function reset() {
    setFiles(cloneFiles(starterFiles)); setMessages([welcome]); setVersions([]); localStorage.removeItem(STORAGE_KEY);
  }

  return <div className="shell">
    <header className="topbar">
      <div className="brand"><div className="brandMark"><Sparkles size={17}/></div><span>FORGE</span><b>Studio</b></div>
      <div className="projectTitle"><span className="statusDot"/>Travel planner <ChevronDown size={14}/></div>
      <div className="topActions"><span className="saveState"><Check size={13}/>{saved ? "Saved" : "Saving"}</span><button className="ghost" onClick={() => setHistoryOpen(true)}><History size={15}/>{versionLabel}</button><button className="iconButton" title="New project" onClick={reset}><Plus size={17}/></button></div>
    </header>
    <div className="workspace">
      <aside className="chatPane">
        <div className="chatHeader"><div><span className="sectionLabel">BUILD TEAM</span><h2>Project chat</h2></div><div className="agentStack"><i>N</i><i>A</i><i>B</i></div></div>
        <div className="messages" ref={scrollRef}>
          {messages.map(message => <div key={message.id} className={`message ${message.role}`}>
            {message.role === "assistant" && <div className={`agentAvatar ${message.agent || "lead"}`}>{message.agent === "builder" ? "B" : "N"}</div>}
            <div><div className="messageMeta">{message.role === "user" ? "You" : message.agent === "builder" ? "Builder · Engineer" : "Nova · Team Lead"}</div><div className="bubble">{message.content}</div></div>
          </div>)}
          {building && <div className="buildCard">
            <div className={stage >= 1 ? "buildStep active" : "buildStep"}><span>{stage > 1 ? <Check size={13}/> : <Loader2 size={13}/>}</span><div><b>Product brief</b><small>Understanding the outcome and constraints</small></div></div>
            <div className={stage >= 2 ? "buildStep active" : "buildStep"}><span>{stage > 2 ? <Check size={13}/> : <Loader2 size={13}/>}</span><div><b>Architecture</b><small>Planning components and interactions</small></div></div>
            <div className={stage >= 3 ? "buildStep active" : "buildStep"}><span><Loader2 size={13}/></span><div><b>Building</b><small>Writing code and validating the preview</small></div></div>
          </div>}
        </div>
        <div className="composerWrap">
          {!building && messages.length < 4 && <div className="suggestions">{examples.slice(0,2).map(x => <button key={x} onClick={() => generate(x)}>{x}<span>↗</span></button>)}</div>}
          <form className="composer" onSubmit={e => { e.preventDefault(); generate(prompt); }}><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(prompt); } }} placeholder="Describe a change or build something new…" rows={2}/><div className="composerBottom"><span><WandSparkles size={14}/> Agent mode</span><button disabled={!prompt.trim() || building}><ArrowUp size={17}/></button></div></form><p className="hint">Enter to send · Shift + Enter for a new line</p>
        </div>
      </aside>
      <main className="canvasPane">
        <div className="canvasToolbar"><div className="viewTabs"><button className={tab === "preview" ? "selected" : ""} onClick={() => setTab("preview")}><Eye size={15}/>Preview</button><button className={tab === "code" ? "selected" : ""} onClick={() => setTab("code")}><Code2 size={15}/>Code</button></div><div className="deviceLabel"><span/> Live preview</div></div>
        <div className="previewStage">
          <SandpackProvider template="react" files={files} theme="light" options={{ activeFile: "/App.js", recompileMode: "delayed", recompileDelay: 400 }}>
            <SandpackLayout className="sandpackFrame">
              {tab === "preview" ? <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton /> : <SandpackCodeEditor showTabs closableTabs showLineNumbers wrapContent />}
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </main>
    </div>
    {historyOpen && <div className="overlay" onMouseDown={() => setHistoryOpen(false)}><aside className="historyDrawer" onMouseDown={e => e.stopPropagation()}><div className="drawerHead"><div><span className="sectionLabel">PROJECT HISTORY</span><h2>Versions</h2></div><button className="iconButton" onClick={() => setHistoryOpen(false)}><X size={18}/></button></div>{versions.length === 0 ? <div className="emptyHistory"><History size={28}/><b>No versions yet</b><p>Ask the team to build or change something.</p></div> : <div className="versionList">{[...versions].reverse().map(v => <article key={v.id}><div className="versionDot"/><div><div className="versionMeta">Version {v.number}<span>{new Date(v.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></div><b>{v.summary}</b><p>{v.prompt}</p><button onClick={() => restore(v)}><RotateCcw size={13}/>Restore this version</button></div></article>)}</div>}</aside></div>}
  </div>;
}
