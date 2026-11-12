import { describe, expect, it } from "vitest";
import { decideSync, hasUserData, referencedBlobs } from "@/lib/sync";
import { buildSampleState } from "@/lib/sample";
import { emptyState } from "@/lib/defaults";

const U = "user-1";
describe("decideSync", () => {
  it("pushes when the cloud has no copy", () => {
    expect(decideSync({ userId: U, meta: null, remoteUpdatedAt: null, localHasData: true })).toBe("push");
  });
  it("pulls onto an empty device", () => {
    expect(decideSync({ userId: U, meta: null, remoteUpdatedAt: "2026-11-12T10:00:00Z", localHasData: false })).toBe("pull");
  });
  it("asks when a device with data meets an existing cloud copy for the first time", () => {
    expect(decideSync({ userId: U, meta: null, remoteUpdatedAt: "2026-11-12T10:00:00Z", localHasData: true })).toBe("conflict");
  });
  it("treats a different user's sync history as unknown", () => {
    expect(decideSync({ userId: U, meta: { userId: "other", remoteUpdatedAt: "x", localDirty: false }, remoteUpdatedAt: "2026-11-12T10:00:00Z", localHasData: true })).toBe("conflict");
  });
  it("pushes local edits when the cloud is unchanged", () => {
    expect(decideSync({ userId: U, meta: { userId: U, remoteUpdatedAt: "2026-11-12T10:00:00Z", localDirty: true }, remoteUpdatedAt: "2026-11-12T10:00:00Z", localHasData: true })).toBe("push");
  });
  it("pulls newer cloud changes when nothing changed locally", () => {
    expect(decideSync({ userId: U, meta: { userId: U, remoteUpdatedAt: "2026-11-12T10:00:00Z", localDirty: false }, remoteUpdatedAt: "2026-11-12T11:00:00Z", localHasData: true })).toBe("pull");
  });
  it("flags a conflict when both sides changed", () => {
    expect(decideSync({ userId: U, meta: { userId: U, remoteUpdatedAt: "2026-11-12T10:00:00Z", localDirty: true }, remoteUpdatedAt: "2026-11-12T11:00:00Z", localHasData: true })).toBe("conflict");
  });
  it("does nothing when already in sync", () => {
    expect(decideSync({ userId: U, meta: { userId: U, remoteUpdatedAt: "2026-11-12T10:00:00Z", localDirty: false }, remoteUpdatedAt: "2026-11-12T10:00:00Z", localHasData: true })).toBe("noop");
  });
});

describe("sync helpers", () => {
  it("ignores default study folders when deciding if a device has data", () => {
    expect(hasUserData(emptyState())).toBe(false);
    expect(hasUserData(buildSampleState())).toBe(true);
  });
  it("collects attachment ids from every part of the journal", () => {
    const s = emptyState();
    s.studyNotes = [{ id: "n", folderId: "f", title: "", blocks: [{ id: "b", type: "image", text: "", blobId: "blob-note" }], videoUrl: "", pinned: false, createdAt: "", updatedAt: "" }];
    s.studyBoards = [{ id: "bd", name: "x", createdAt: "", cards: [{ id: "c", kind: "pdf", refId: null, blobId: "blob-pdf", title: "", body: "", url: "", x: 0, y: 0, w: 1 }] }];
    expect(referencedBlobs(s).sort()).toEqual(["blob-note", "blob-pdf"]);
  });
});
