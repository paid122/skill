/** A tiny in-memory vault with the parts of Obsidian's API the note sync uses. Tests only. */
export const normalizePath = (p: string) => p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
export class TAbstractFile { constructor(public path: string) {} }
export class TFile extends TAbstractFile { get name() { return this.path.split("/").pop()!; } }
export class TFolder extends TAbstractFile {}

function frontmatter(text: string): Record<string, unknown> | undefined {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return undefined;
  const o: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) { const k = line.match(/^([\w-]+):\s*(.*)$/); if (k) o[k[1]] = k[2].startsWith('"') ? JSON.parse(k[2]) : k[2]; }
  return o;
}

export class FakeApp {
  files = new Map<string, string>();
  folders = new Set<string>();
  writes = 0;
  vault = {
    getAbstractFileByPath: (p: string) => (this.files.has(p) ? new TFile(p) : this.folders.has(p) ? new TFolder(p) : null),
    createFolder: async (p: string) => { this.folders.add(p); },
    read: async (f: TFile) => this.files.get(f.path)!,
    modify: async (f: TFile, t: string) => { this.files.set(f.path, t); this.writes++; },
    create: async (p: string, t: string) => { if (this.files.has(p)) throw new Error("exists"); this.files.set(p, t); this.writes++; return new TFile(p); },
    getMarkdownFiles: () => [...this.files.keys()].filter((p) => p.endsWith(".md")).map((p) => new TFile(p)),
    getFiles: () => [...this.files.keys()].map((p) => new TFile(p)),
  };
  metadataCache = { getFileCache: (f: TFile) => ({ frontmatter: frontmatter(this.files.get(f.path) ?? "") }) };
  fileManager = {
    processFrontMatter: async (f: TFile, fn: (fm: Record<string, unknown>) => void) => {
      const text = this.files.get(f.path)!, fm = frontmatter(text) ?? {};
      fn(fm);
      const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
      this.files.set(f.path, `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")}\n---\n${body}`);
    },
  };
}
