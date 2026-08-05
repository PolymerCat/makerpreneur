// ponytail: heuristic merge rules; embeddings are approximate, so thresholds are
// tuned for the demonstrated failure (name changes). If false merges appear,
// bump the thresholds; if duplicates still slip through, lower them.

export type MemoryCandidate = {
  type: string;
  content: string;
  similarity: number;
};

export type MergeDecision = { action: "replace" } | { action: "insert" };

var NAME_SLOT_RE = /(name|nickname|be\s+called|known\s+as|call\s+(?:me|myself|him|her|himself|herself|us|them|ourselves|themselves))/i;

function isIdentityType(type: string): boolean {
  return type === "fact" || type === "preference";
}

function isNameSlot(content: string): boolean {
  return NAME_SLOT_RE.test(content);
}

export function decideMemoryMerge(
  newType: string,
  newContent: string,
  candidate: MemoryCandidate | null
): MergeDecision {
  if (!candidate || candidate.type === "episode") {
    return { action: "insert" };
  }

  var sameType = newType === candidate.type;
  var identityPair = isIdentityType(newType) && isIdentityType(candidate.type);
  var nameSlot = isNameSlot(newContent) && isNameSlot(candidate.content);
  var sim = candidate.similarity;

  if (nameSlot && identityPair && sim >= 0.5) {
    return { action: "replace" };
  }
  if (sameType && sim >= 0.78) {
    return { action: "replace" };
  }
  if (identityPair && !sameType && sim >= 0.85) {
    return { action: "replace" };
  }
  return { action: "insert" };
}

export function looksGlobal(type: string, content: string): boolean {
  if (type === "weakness" || type === "goal") {
    return false;
  }
  return /name|language|speak|prefer|background/i.test(content);
}
