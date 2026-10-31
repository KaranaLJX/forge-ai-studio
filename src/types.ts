export type ProjectFiles = Record<string, { code: string }>;

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  agent?: "lead" | "architect" | "builder";
};

export type Version = {
  id: string;
  number: number;
  prompt: string;
  summary: string;
  files: ProjectFiles;
  createdAt: number;
};

export type StoredProject = {
  files: ProjectFiles;
  messages: Message[];
  versions: Version[];
  updatedAt: number;
};

export type ProjectRecord = StoredProject & { id: string; name: string };
export type Workspace = { activeProjectId: string; projects: ProjectRecord[] };
