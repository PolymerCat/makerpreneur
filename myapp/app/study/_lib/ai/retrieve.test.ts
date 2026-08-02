import { describe, it, expect } from "vitest";
import { rrfFuse } from "./retrieve";

describe("rrfFuse Deduplication & Keying Stress Tests", () => {
  it("stress-tests duplicate IDs across DIFFERENT materials (keying collision bug)", () => {
    // Two distinct materials have chunks with the exact same chunk ID (e.g. "chunk-1")
    const list1 = [
      { id: "chunk-1", materialId: "mat-A", chunkIndex: 0, text: "Material A Chunk Content" }
    ];
    const list2 = [
      { id: "chunk-1", materialId: "mat-B", chunkIndex: 0, text: "Material B Chunk Content" }
    ];

    const result = rrfFuse([list1, list2], 60);

    // If keying is buggy (using item.id alone), list2's item overwrites list1's item in scoreMap
    // so result length will be 1 instead of 2.
    console.log("Duplicate ID across different materials result length:", result.length);
    expect(result.length).toBe(2); // Should preserve both chunks from mat-A and mat-B
  });

  it("stress-tests missing chunkIndex with overlapping text", () => {
    const list1 = [
      { materialId: "mat-A", text: "Summary section of chapter 1" }
    ];
    const list2 = [
      { materialId: "mat-A", text: "Summary section of chapter 1" }
    ];

    const result = rrfFuse([list1, list2], 60);
    // Identical text in same material without chunkIndex should merge
    expect(result.length).toBe(1);
    expect(result[0].text).toBe("Summary section of chapter 1");
  });

  it("stress-tests missing materialId keying fallback", () => {
    // Chunks from two different lists lacking materialId but having chunkIndex: 1
    const list1 = [{ chunkIndex: 1, text: "Physics content" }];
    const list2 = [{ chunkIndex: 1, text: "Chemistry content" }];

    const result = rrfFuse([list1, list2], 60);

    // key evaluates to ("undefined:1") for both, causing collision
    console.log("Missing materialId result length:", result.length);
    expect(result.length).toBe(2);
  });

  it("stress-tests missing materialId, chunkIndex, AND id (only text)", () => {
    const list1 = [{ text: "Universal gravitation formula" }];
    const list2 = [{ text: "Universal gravitation formula" }];

    const result = rrfFuse([list1, list2], 60);
    expect(result.length).toBe(1);
  });

  it("stress-tests falsy id vs string '0'", () => {
    const list1 = [{ id: "0", materialId: "mat-1", text: "Zero ID Mat 1" }];
    const list2 = [{ id: "0", materialId: "mat-2", text: "Zero ID Mat 2" }];

    const result = rrfFuse([list1, list2], 60);
    console.log("String '0' ID across materials result length:", result.length);
    expect(result.length).toBe(2);
  });
});
