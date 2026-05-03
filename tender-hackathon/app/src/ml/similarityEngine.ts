export interface SimilarityResult {
  similarityScore: number;
  matchedText: { fromA: string; fromB: string }[];
  repeatedPhrases: string[];
  redFlagSeverity: "Critical" | "Moderate" | "Low";
  suggestedOfficerAction: string;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function compareDocuments(a: string, b: string): SimilarityResult {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  const inter = [...ta].filter((x) => tb.has(x));
  const union = new Set([...ta, ...tb]);
  const score = union.size === 0 ? 0 : inter.length / union.size;

  const phrasesA = phrases(a);
  const phrasesB = phrases(b);
  const repeatedPhrases = phrasesA.filter((p) => phrasesB.includes(p));

  let severity: SimilarityResult["redFlagSeverity"] = "Low";
  let suggestedOfficerAction = "Routine review";
  if (score > 0.8) {
    severity = "Critical";
    suggestedOfficerAction = "Investigate possible collusion / template re-use across competing bidders";
  } else if (score > 0.55) {
    severity = "Moderate";
    suggestedOfficerAction = "Request differentiated technical proposals from bidders";
  }

  return {
    similarityScore: Number(score.toFixed(3)),
    matchedText: inter.slice(0, 8).map((w) => ({ fromA: w, fromB: w })),
    repeatedPhrases: repeatedPhrases.slice(0, 8),
    redFlagSeverity: severity,
    suggestedOfficerAction,
  };
}

function phrases(s: string): string[] {
  const tokens = tokenize(s);
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 2; i++) {
    out.push(tokens.slice(i, i + 3).join(" "));
  }
  return out;
}
