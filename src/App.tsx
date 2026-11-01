import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SandpackCodeEditor, SandpackLayout, SandpackPreview, SandpackProvider, useSandpack } from "@codesandbox/sandpack-react";
import { ArrowRight, ArrowUp, Check, ChevronDown, Code2, Download, Eye, History, LayoutGrid, Loader2, Pencil, Plus, RotateCcw, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import type { Message, ProjectFiles, ProjectRecord, StoredProject, Version, Workspace } from "./types";
import { blankFiles, starterFiles } from "./starter";

const STORAGE_KEY = "forge-studio-project-v1";
const WORKSPACE_KEY = "forge-studio-workspace-v1";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const cloneFiles = (files: ProjectFiles): ProjectFiles => JSON.parse(JSON.stringify(files));
const welcome: Message = { id: "welcome", role: "assistant", agent: "lead", content: "Hi, I’m Nova, your build lead. Describe the app you want and I’ll coordinate the plan, code, and preview.", createdAt: Date.now() };

const examples = ["Build a calm travel budget planner", "Create a focused task board", "Switch the app to a violet theme"];

const concatBytes = (parts: Uint8Array[]) => { const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; parts.forEach(part => { result.set(part, offset); offset += part.length; }); return result; };
const crc32 = (data: Uint8Array) => { let crc = -1; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; };
function downloadProject(files: ProjectFiles, name: string) {
  const encoder = new TextEncoder(); const localParts: Uint8Array[] = []; const centralParts: Uint8Array[] = []; let offset = 0;
  Object.entries(files).forEach(([path, file]) => {
    const fileName = encoder.encode(path.replace(/^\//, "")); const content = encoder.encode(file.code); const crc = crc32(content);
    const local = new Uint8Array(30 + fileName.length); const lv = new DataView(local.buffer); lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint32(14, crc, true); lv.setUint32(18, content.length, true); lv.setUint32(22, content.length, true); lv.setUint16(26, fileName.length, true); local.set(fileName, 30);
    const central = new Uint8Array(46 + fileName.length); const cv = new DataView(central.buffer); cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint32(16, crc, true); cv.setUint32(20, content.length, true); cv.setUint32(24, content.length, true); cv.setUint16(28, fileName.length, true); cv.setUint32(42, offset, true); central.set(fileName, 46);
    localParts.push(local, content); centralParts.push(central); offset += local.length + content.length;
  });
  const central = concatBytes(centralParts); const end = new Uint8Array(22); const ev = new DataView(end.buffer); ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, centralParts.length, true); ev.setUint16(10, centralParts.length, true); ev.setUint32(12, central.length, true); ev.setUint32(16, offset, true);
  const blob = new Blob([concatBytes([...localParts, central, end])], { type: "application/zip" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "forge-project"}.zip`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SandpackWorkspace({ tab, onFilesChange, onError }: { tab: "preview" | "code"; onFilesChange: (files: ProjectFiles) => void; onError: (error: string | null) => void }) {
  const { sandpack } = useSandpack();
  useEffect(() => {
    if (sandpack.editorState !== "dirty") return;
    const timer = window.setTimeout(() => onFilesChange(cloneFiles(sandpack.files as ProjectFiles)), 500);
    return () => window.clearTimeout(timer);
  }, [sandpack.editorState, sandpack.files, onFilesChange]);
  useEffect(() => {
    const error = sandpack.error as { message?: string } | null;
    onError(error ? error.message || String(error) : null);
  }, [sandpack.error, onError]);
  return <>
    <div className={tab === "preview" ? "sandpackView active" : "sandpackView"}><SandpackLayout className="sandpackFrame"><SandpackPreview showOpenInCodeSandbox={false} showRefreshButton /></SandpackLayout></div>
    <div className={tab === "code" ? "sandpackView active" : "sandpackView"}><SandpackLayout className="sandpackFrame"><SandpackCodeEditor showTabs closableTabs showLineNumbers wrapContent /></SandpackLayout></div>
  </>;
}

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
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [codeDirty, setCodeDirty] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [screen, setScreen] = useState<"dashboard" | "studio">("dashboard");
  const [initialBuildMode, setInitialBuildMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const workspaceRaw = localStorage.getItem(WORKSPACE_KEY);
      if (workspaceRaw) {
        const workspace: Workspace = JSON.parse(workspaceRaw);
        const active = workspace.projects.find(project => project.id === workspace.activeProjectId) || workspace.projects[0];
        if (active) { setProjects(workspace.projects); setActiveProjectId(active.id); setFiles(active.files); setMessages(active.messages); setVersions(active.versions); }
      } else {
        const legacyRaw = localStorage.getItem(STORAGE_KEY);
        const legacy: StoredProject | null = legacyRaw ? JSON.parse(legacyRaw) : null;
        const project: ProjectRecord = { id: uid(), name: legacy?.messages.find(message => message.role === "user")?.content.slice(0, 28) || "My first app", files: legacy?.files || cloneFiles(starterFiles), messages: legacy?.messages || [welcome], versions: legacy?.versions || [], updatedAt: Date.now() };
        setProjects([project]); setActiveProjectId(project.id); setFiles(project.files); setMessages(project.messages); setVersions(project.versions);
      }
    } catch { localStorage.removeItem(WORKSPACE_KEY); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !activeProjectId) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      setProjects(current => {
        const next = current.map(project => project.id === activeProjectId ? { ...project, files, messages, versions, updatedAt: Date.now() } : project);
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ activeProjectId, projects: next } satisfies Workspace));
        return next;
      });
      setSaved(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [files, messages, versions, activeProjectId, hydrated]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, stage]);

  const versionLabel = useMemo(() => versions.length ? `Version ${versions.length}` : "Draft", [versions]);

  async function generate(text: string) {
    if (!text.trim() || building) return;
    const clean = text.trim();
    const initialBuild = versions.length === 0 && !/^(开始(?:构建)?吧?|继续吧?|好的?|可以|行)$/i.test(clean);
    setInitialBuildMode(initialBuild);
    setProjects(current => current.map(project => project.id === activeProjectId && (project.name === "Untitled app" || project.name === "My first app") ? { ...project, name: clean.slice(0, 28) } : project));
    setPrompt(""); setBuilding(true); setStage(1);
    setMessages(prev => [...prev, { id: uid(), role: "user", content: clean, createdAt: Date.now() }]);
    let result: { files: ProjectFiles; summary: string; mode?: string; changed?: boolean; changedFiles?: string[] };
    try {
      const call = (payload: object) => fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const runStep = async (stepFiles: ProjectFiles, targetFile?: string) => {
        let response = await call({ prompt: clean, files: stepFiles, targetFile });
        if (response.status === 422) {
          const invalid = await response.json();
          response = await call({ prompt: clean, files: invalid.files, repairError: invalid.detail, targetFile });
        }
        if (!response.ok) {
          const failure = await response.json().catch(() => ({}));
          throw new Error(failure.detail || "AI generation failed");
        }
        return response.json();
      };
      if (initialBuild) {
        setStage(2);
        const appStep = await runStep(files, "/App.js");
        setStage(3);
        const styleStep = await runStep(appStep.files, "/styles.css");
        setStage(4);
        result = { ...styleStep, summary: appStep.summary, changedFiles: [...new Set([...(appStep.changedFiles || []), ...(styleStep.changedFiles || [])])] };
      } else {
        setStage(2);
        result = await runStep(files);
        setStage(4);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: `Generation stopped safely: ${detail}. Your current app is unchanged—please retry.`, createdAt: Date.now() }]);
      setStage(0); setBuilding(false);
      return;
    }
    if (result.changed === false) {
      setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: result.summary, createdAt: Date.now() }]);
      setStage(0); setBuilding(false);
      return;
    }
    const nextVersion: Version = { id: uid(), number: versions.length + 1, prompt: clean, summary: result.summary, files: cloneFiles(result.files), createdAt: Date.now(), changedFiles: result.changedFiles };
    setFiles(result.files); setVersions(prev => [...prev, nextVersion]); setCodeDirty(false); setRuntimeError(null);
    setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: result.summary, createdAt: Date.now() }]);
    setStage(0); setBuilding(false);
  }

  function restore(version: Version) {
    const restored = cloneFiles(version.files);
    const newVersion: Version = { id: uid(), number: versions.length + 1, prompt: `Restore version ${version.number}`, summary: `Restored the project to Version ${version.number}.`, files: restored, createdAt: Date.now() };
    setFiles(restored); setVersions(prev => [...prev, newVersion]); setHistoryOpen(false); setCodeDirty(false); setRuntimeError(null);
    setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: newVersion.summary, createdAt: Date.now() }]);
  }

  function saveCodeVersion() {
    const nextVersion: Version = { id: uid(), number: versions.length + 1, prompt: "Manual code edit", summary: "Saved manual changes from the code editor.", files: cloneFiles(files), createdAt: Date.now(), changedFiles: Object.keys(files) };
    setVersions(prev => [...prev, nextVersion]); setCodeDirty(false);
    setMessages(prev => [...prev, { id: uid(), role: "assistant", agent: "builder", content: "Saved the code editor changes as a new version.", createdAt: Date.now() }]);
  }

  function createProject() {
    const project: ProjectRecord = { id: uid(), name: "Untitled app", files: cloneFiles(blankFiles), messages: [{ ...welcome, id: uid(), createdAt: Date.now() }], versions: [], updatedAt: Date.now() };
    const next = [...projects.map(item => item.id === activeProjectId ? { ...item, files, messages, versions, updatedAt: Date.now() } : item), project];
    setProjects(next); setActiveProjectId(project.id); setFiles(project.files); setMessages(project.messages); setVersions([]); setCodeDirty(false); setRuntimeError(null);
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ activeProjectId: project.id, projects: next } satisfies Workspace)); setScreen("studio");
  }

  function switchProject(id: string) {
    const target = projects.find(project => project.id === id);
    if (!target) return;
    if (id === activeProjectId) { setScreen("studio"); return; }
    const next = projects.map(project => project.id === activeProjectId ? { ...project, files, messages, versions, updatedAt: Date.now() } : project);
    setProjects(next); setActiveProjectId(target.id); setFiles(cloneFiles(target.files)); setMessages(target.messages); setVersions(target.versions); setCodeDirty(false); setRuntimeError(null);
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ activeProjectId: target.id, projects: next } satisfies Workspace)); setScreen("studio");
  }

  function renameProject() {
    const active = projects.find(project => project.id === activeProjectId);
    const name = window.prompt("Project name", active?.name || "")?.trim();
    if (!name) return;
    setProjects(current => { const next = current.map(project => project.id === activeProjectId ? { ...project, name: name.slice(0, 40) } : project); localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ activeProjectId, projects: next } satisfies Workspace)); return next; });
  }

  function deleteProject() {
    if (projects.length <= 1 || !window.confirm("Delete this project and its local history?")) return;
    const remaining = projects.filter(project => project.id !== activeProjectId);
    const next = remaining[0];
    setProjects(remaining); setActiveProjectId(next.id); setFiles(cloneFiles(next.files)); setMessages(next.messages); setVersions(next.versions); setCodeDirty(false); setRuntimeError(null);
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ activeProjectId: next.id, projects: remaining } satisfies Workspace));
  }

  const handleSandpackFiles = useCallback((next: ProjectFiles) => { setFiles(next); setCodeDirty(true); }, []);
  const handleSandpackError = useCallback((error: string | null) => setRuntimeError(error), []);

  if (!hydrated) return <div className="dashboardLoading"><Sparkles size={22}/>Loading workspace…</div>;
  if (screen === "dashboard") return <div className="dashboardShell">
    <header className="dashboardNav"><div className="brand"><div className="brandMark"><Sparkles size={17}/></div><span>FORGE</span><b>Studio</b></div><button className="newProjectButton" onClick={createProject}><Plus size={16}/>New project</button></header>
    <main className="dashboardMain"><div className="dashboardHero"><div><span className="sectionLabel">YOUR AI WORKSPACE</span><h1>Build something remarkable.</h1><p>Turn an idea into a working React app, then keep improving it with your AI team.</p></div><div className="dashboardStat"><strong>{projects.length}</strong><span>Projects</span></div></div>
      <div className="projectSectionHead"><div><h2>Your projects</h2><p>Everything is saved in this browser.</p></div><LayoutGrid size={18}/></div>
      <div className="projectGrid"><button className="createCard" onClick={createProject}><span><Plus size={22}/></span><b>Start a new project</b><small>Begin with a blank canvas</small></button>{[...projects].sort((a,b) => b.updatedAt-a.updatedAt).map((project,index) => <button className="projectCard" key={project.id} onClick={() => switchProject(project.id)}><div className={`projectThumb tone${index%4}`}><div className="thumbBar"><i/><i/><i/></div><span>{project.name.slice(0,1).toUpperCase()}</span><div className="thumbLines"><i/><i/><i/></div></div><div className="projectCardBody"><div><b>{project.name}</b><small>{project.versions.length} versions · {project.messages.filter(message => message.role === "user").length} requests</small></div><div className="projectCardFoot"><span>{new Date(project.updatedAt).toLocaleDateString()}</span><ArrowRight size={15}/></div></div></button>)}</div>
    </main>
  </div>;

  return <div className="shell">
    <header className="topbar">
      <button className="brand brandButton" onClick={() => setScreen("dashboard")}><div className="brandMark"><Sparkles size={17}/></div><span>FORGE</span><b>Studio</b></button>
      <label className="projectTitle"><span className="statusDot"/><select aria-label="Switch project" value={activeProjectId} onChange={event => switchProject(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select><ChevronDown size={14}/></label>
      <div className="topActions"><span className="saveState"><Check size={13}/>{saved ? "Saved" : "Saving"}</span><button className="iconButton" title="Export project ZIP" onClick={() => downloadProject(files, projects.find(project => project.id === activeProjectId)?.name || "forge-project")}><Download size={14}/></button><button className="iconButton" title="Rename project" onClick={renameProject}><Pencil size={14}/></button><button className="iconButton" title="Delete project" disabled={projects.length <= 1} onClick={deleteProject}><Trash2 size={14}/></button><button className="ghost" onClick={() => setHistoryOpen(true)}><History size={15}/>{versionLabel}</button><button className="iconButton" title="New project" onClick={createProject}><Plus size={17}/></button></div>
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
            <div className={stage >= 1 ? "buildStep active" : "buildStep"}><span>{stage > 1 ? <Check size={13}/> : <Loader2 size={13}/>}</span><div><b>Understand request</b><small>Reading the current project and desired outcome</small></div></div>
            <div className={stage >= 2 ? "buildStep active" : "buildStep"}><span>{stage > 2 ? <Check size={13}/> : <Loader2 size={13}/>}</span><div><b>{initialBuildMode ? "Write App.js" : "Apply code patch"}</b><small>{initialBuildMode ? "Creating components and interactions" : "Changing only the relevant code"}</small></div></div>
            {initialBuildMode && <div className={stage >= 3 ? "buildStep active" : "buildStep"}><span>{stage > 3 ? <Check size={13}/> : <Loader2 size={13}/>}</span><div><b>Write styles.css</b><small>Building the responsive visual system</small></div></div>}
            <div className={stage >= 4 ? "buildStep active" : "buildStep"}><span><Loader2 size={13}/></span><div><b>Validate project</b><small>Checking syntax before updating the preview</small></div></div>
          </div>}
        </div>
        <div className="composerWrap">
          {!building && messages.length < 4 && <div className="suggestions">{examples.slice(0,2).map(x => <button key={x} onClick={() => generate(x)}>{x}<span>↗</span></button>)}</div>}
          <form className="composer" onSubmit={e => { e.preventDefault(); generate(prompt); }}><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(prompt); } }} placeholder="Describe a change or build something new…" rows={2}/><div className="composerBottom"><span><WandSparkles size={14}/> Agent mode</span><button disabled={!prompt.trim() || building}><ArrowUp size={17}/></button></div></form><p className="hint">Enter to send · Shift + Enter for a new line</p>
        </div>
      </aside>
      <main className="canvasPane">
        <div className="canvasToolbar"><div className="viewTabs"><button className={tab === "preview" ? "selected" : ""} onClick={() => setTab("preview")}><Eye size={15}/>Preview</button><button className={tab === "code" ? "selected" : ""} onClick={() => setTab("code")}><Code2 size={15}/>Code</button></div><div className="canvasStatus">{codeDirty && <button className="saveCode" onClick={saveCodeVersion}><Check size={13}/>Save code version</button>}<div className="deviceLabel"><span/> Live preview</div></div></div>
        <div className="previewStage">
          <SandpackProvider template="react" files={files} theme="light" options={{ activeFile: "/App.js", recompileMode: "delayed", recompileDelay: 400 }}>
            <SandpackWorkspace tab={tab} onFilesChange={handleSandpackFiles} onError={handleSandpackError}/>
          </SandpackProvider>
          {runtimeError && <div className="runtimeError"><div><b>Preview error</b><span>{runtimeError}</span></div><button onClick={() => generate(`Fix this preview error: ${runtimeError}`)}>Ask AI to fix</button></div>}
        </div>
      </main>
    </div>
    {historyOpen && <div className="overlay" onMouseDown={() => setHistoryOpen(false)}><aside className="historyDrawer" onMouseDown={e => e.stopPropagation()}><div className="drawerHead"><div><span className="sectionLabel">PROJECT HISTORY</span><h2>Versions</h2></div><button className="iconButton" onClick={() => setHistoryOpen(false)}><X size={18}/></button></div>{versions.length === 0 ? <div className="emptyHistory"><History size={28}/><b>No versions yet</b><p>Ask the team to build or change something.</p></div> : <div className="versionList">{[...versions].reverse().map(v => <article key={v.id}><div className="versionDot"/><div><div className="versionMeta">Version {v.number}<span>{new Date(v.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></div><b>{v.summary}</b><p>{v.prompt}</p>{v.changedFiles?.length ? <div className="changedFiles">{v.changedFiles.map(file => <span key={file}>{file}</span>)}</div> : null}<button onClick={() => restore(v)}><RotateCcw size={13}/>Restore this version</button></div></article>)}</div>}</aside></div>}
  </div>;
}
