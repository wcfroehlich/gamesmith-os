import { createHash } from "crypto";
import { StoryPackage } from "@/agents/jimmy/types-package";
import { StoryEvent, ArticleRecord } from "@/lib/types";

export type CanonicalStoryRow = {
  id: string;
  canonical_headline: string;
  short_description?: string | null;
  story_type?: string | null;
  current_freshness_state?: string | null;
  portfolio_lane: string;
  current_triage_decision: string;
  legacy_import_summary?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  story_source_links?: {
    source_material?: {
      id: string;
      title: string;
      publisher_name?: string | null;
      canonical_url?: string | null;
      original_url?: string | null;
      content_excerpt?: string | null;
      discovered_at?: string | null;
    } | null;
  }[];
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function checksumPayload(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export function candidateKeyForPackage(storyPackage: StoryPackage) {
  return slugify(
    [
      storyPackage.story_title,
      storyPackage.story_arc,
      storyPackage.primary_source,
    ]
      .filter(Boolean)
      .join("-")
  );
}

export function packageLegacySummary(storyPackage: StoryPackage) {
  return {
    legacy_source: "jimmy",
    story_title: storyPackage.story_title,
    package_type: storyPackage.package_type,
    story_arc: storyPackage.story_arc,
    content_score: storyPackage.content_scores.total,
    time_score: storyPackage.time_scores.total,
    importance_score: storyPackage.editorial_importance.score,
    recommended_state: storyPackage.recommended_state,
    verification_status: storyPackage.verification_status,
    confidence_score: storyPackage.confidence_score,
    sponsorship_risk: storyPackage.sponsorship_risk,
    bias_risk: storyPackage.bias_risk,
    imported_rationale:
      storyPackage.editorial_importance.reason ||
      "Imported legacy state; original rationale unavailable",
  };
}

export function canonicalStoryToStoryEvent(row: CanonicalStoryRow): StoryEvent {
  const summary = row.legacy_import_summary || {};
  const articles: ArticleRecord[] = (row.story_source_links || [])
    .map((link) => link.source_material)
    .filter(Boolean)
    .map((source) => ({
      id: source!.id,
      title: source!.title,
      source: source!.publisher_name || "Unknown",
      url: source!.canonical_url || source!.original_url || "",
      summary: source!.content_excerpt || "",
      found_at: source!.discovered_at || row.created_at,
    }));

  return {
    id: row.id,
    title: row.canonical_headline,
    real_story: row.short_description || "",
    domain: row.story_type || "Other",
    story_arc: String(summary.story_arc || row.story_type || "Other"),
    package_type: String(summary.package_type || "Story Event"),
    status: row.portfolio_lane === "archive" ? "Archived" : "Banked",
    content_score: Number(summary.content_score || 0),
    time_score: Number(summary.time_score || 0),
    importance_score: Number(summary.importance_score || 0),
    verification_status: String(summary.verification_status || "Unverified"),
    confidence_score: Number(summary.confidence_score || 0),
    sponsorship_risk: String(summary.sponsorship_risk || "Unknown"),
    bias_risk: String(summary.bias_risk || "Unknown"),
    freshness_status: row.current_freshness_state || "Stable",
    recommended_state: String(summary.recommended_state || "Review"),
    expiration_date: "",
    why_gamers_care: "",
    why_it_cannot_be_ignored: String(summary.imported_rationale || ""),
    who_benefits: "",
    who_pays: "",
    ownership_notes: "",
    talent_notes: "",
    tension_notes: "",
    consequence_notes: "",
    score_reasoning: "",
    source_count: new Set(articles.map((article) => article.source)).size,
    article_count: articles.length,
    articles,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
