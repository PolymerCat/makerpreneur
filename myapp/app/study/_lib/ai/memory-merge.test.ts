import { describe, it, expect } from "vitest";
import { decideMemoryMerge, looksGlobal } from "./memory-merge";

describe("decideMemoryMerge", () => {
  it("replaces an old name memory with the same type at moderate similarity", () => {
    var d = decideMemoryMerge("preference", "Preferred name: bobo", {
      type: "preference",
      content: "Preferred name: faiqfdhh",
      similarity: 0.63
    });
    expect(d.action).toBe("replace");
  });

  it("replaces a name memory across fact/preference types", () => {
    var d = decideMemoryMerge("preference", "Student prefers to be called bobo", {
      type: "fact",
      content: "student's name is Faiq",
      similarity: 0.55
    });
    expect(d.action).toBe("replace");
  });

  it("does not replace when name-slot similarity is too low", () => {
    var d = decideMemoryMerge("preference", "prefers to be called bobo", {
      type: "preference",
      content: "prefers visual learning",
      similarity: 0.3
    });
    expect(d.action).toBe("insert");
  });

  it("replaces same-type non-name memories at high similarity", () => {
    var d = decideMemoryMerge("preference", "prefers visual learning", {
      type: "preference",
      content: "prefers visual learning materials",
      similarity: 0.85
    });
    expect(d.action).toBe("replace");
  });

  it("inserts same-type non-name memories at low similarity", () => {
    var d = decideMemoryMerge("weakness", "struggles with 4G", {
      type: "weakness",
      content: "struggles with public speaking",
      similarity: 0.4
    });
    expect(d.action).toBe("insert");
  });

  it("never replaces an episode row", () => {
    var d = decideMemoryMerge("fact", "anything", {
      type: "episode",
      content: "conversation summary",
      similarity: 0.99
    });
    expect(d.action).toBe("insert");
  });

  it("never replaces a weakness with a preference", () => {
    var d = decideMemoryMerge("preference", "prefers morning study", {
      type: "weakness",
      content: "procrastinates in the mornings",
      similarity: 0.9
    });
    expect(d.action).toBe("insert");
  });

  it("never replaces a goal with a fact", () => {
    var d = decideMemoryMerge("fact", "exam is in June", {
      type: "goal",
      content: "score an A on the June exam",
      similarity: 0.9
    });
    expect(d.action).toBe("insert");
  });

  it("inserts when there is no candidate", () => {
    expect(decideMemoryMerge("fact", "anything", null).action).toBe("insert");
  });
});

describe("looksGlobal", () => {
  it("flags identity content as global", () => {
    expect(looksGlobal("preference", "Preferred name: bobo")).toBe(true);
    expect(looksGlobal("fact", "student speaks Malay")).toBe(true);
    expect(looksGlobal("preference", "prefers morning study sessions")).toBe(true);
  });

  it("keeps subject-specific content scoped", () => {
    expect(looksGlobal("weakness", "struggles with eigenvalues")).toBe(false);
    expect(looksGlobal("goal", "pass the exam")).toBe(false);
    expect(looksGlobal("fact", "covered 5G protocols in lecture 4")).toBe(false);
  });
});
