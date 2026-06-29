export type StoryState = {
  intake_state: string;
  current_triage_decision: string;
  portfolio_lane: string;
  research_state: string;
  merged_into_story_id?: string | null;
};

export type TriageOutcome = "good" | "maybe" | "bad";

export function assertTriageTransition(
  current: StoryState,
  outcome: TriageOutcome
) {
  if (current.merged_into_story_id) {
    throw new Error("Merged stories cannot be triaged directly.");
  }

  if (
    current.research_state !== "not_started" &&
    current.portfolio_lane === "story_bank"
  ) {
    throw new Error("Story Bank records cannot carry active research state.");
  }

  if (outcome === "maybe") return;
  if (outcome === "bad") return;
  if (outcome === "good") return;

  throw new Error(`Unsupported triage outcome: ${outcome}`);
}

export function triageRationale(outcome: TriageOutcome, supplied?: string) {
  if (supplied?.trim()) return supplied.trim();

  if (outcome === "maybe") {
    return "William triaged this Story as MAYBE for Story Bank.";
  }

  if (outcome === "bad") {
    return "William triaged this Story as BAD for Archive.";
  }

  return "William triaged this Story as GOOD for active research.";
}
