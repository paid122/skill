import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run without Obsidian: "obsidian" points at a small in-memory stand-in (tests/fake-obsidian.ts).
export default defineConfig({ resolve: { alias: { obsidian: fileURLToPath(new URL("./tests/fake-obsidian.ts", import.meta.url)) } } });
