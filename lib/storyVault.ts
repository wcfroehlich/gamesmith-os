import fs from "fs";
import path from "path";
import { StoryPackage } from "@/agents/jimmy/types-package";
import { ArticleRecord, StoryEvent, WatchTarget } from "./types";

const dataDir = path.join(process.cwd(), "data");
const bankPath = path.join(dataDir, "story-bank.json");
const archivePath = path.join(dataDir, "story-archive.json");
const watchListPath = path.join(dataDir, "watch-list.json");

function ensureFile(filePath: string) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]");
  }
}

function readJson<T>(filePath: string): T[] {
  ensureFile(filePath);

  const raw = fs.readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeJson<T>(filePath: string, data: T[]) {
  ensureFile(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function now() {
  return new Date().toISOString();
}

function cleanCell(value: unknown) {
  if (value === undefined || value === null) return "";

  return String(value)
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function packageToStoryEvent(storyPackage: StoryPackage): StoryEvent {
  const timestamp = now();

  const articles: ArticleRecord[] = storyPackage.articles.map((article) => ({
    id: slugify(`${article.source}-${article.title}`),
    title: article.title,
    source: article.source,
    url: article.url,
    summary: article.summary,
    found_at: timestamp,
  }));

  return {
    id: slugify(storyPackage.story_title),
    title: storyPackage.story_title,
    real_story: storyPackage.real_story,
    domain: storyPackage.gamesmith_story_type,
    secondary_domain: storyPackage.secondary_story_type,
    story_arc: storyPackage.story_arc,
    package_type: storyPackage.package_type,
    status: "Banked",

    content_score: storyPackage.content_scores.total,
    time_score: storyPackage.time_scores.total,
    importance_score: storyPackage.editorial_importance.score,

    verification_status: storyPackage.verification_status,
    confidence_score: storyPackage.confidence_score,
    sponsorship_risk: storyPackage.sponsorship_risk,
    bias_risk: storyPackage.bias_risk,

    freshness_status: storyPackage.freshness_status,
    recommended_state: storyPackage.recommended_state,
    expiration_date: storyPackage.expiration_estimate,

    why_gamers_care: storyPackage.why_gamers_care,
    why_it_cannot_be_ignored: storyPackage.editorial_importance.reason,

    who_benefits: storyPackage.who_benefits,
    who_pays: storyPackage.who_pays,
    ownership_notes: storyPackage.ownership_notes,
    talent_notes: storyPackage.talent_notes,
    tension_notes: storyPackage.tension_notes,
    consequence_notes: storyPackage.consequence_notes,
    score_reasoning: storyPackage.score_reasoning,

    source_count: storyPackage.source_count,
    article_count: storyPackage.article_count,
    articles,

    created_at: timestamp,
    updated_at: timestamp,
  };
}

function packageToWatchTarget(storyPackage: StoryPackage): WatchTarget {
  const timestamp = now();

  const watchTerms = [
    storyPackage.story_title,
    storyPackage.story_arc,
    storyPackage.gamesmith_story_type,
    storyPackage.secondary_story_type,
    ...storyPackage.sub_events,
  ].filter(Boolean);

  return {
    id: slugify(`${storyPackage.story_arc}-${storyPackage.story_title}`),
    label: storyPackage.story_title,
    domain: storyPackage.gamesmith_story_type,
    story_arc: storyPackage.story_arc,
    search_mode:
      storyPackage.verification_status === "Predictive"
        ? "Emerging Signals"
        : "Arc Watch",
    watch_terms: Array.from(new Set(watchTerms)),
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function bankStory(storyPackage: StoryPackage) {
  const bank = readJson<StoryEvent>(bankPath);
  const event = packageToStoryEvent(storyPackage);

  const updatedBank = [event, ...bank.filter((item) => item.id !== event.id)];

  writeJson(bankPath, updatedBank);

  const watchList = readJson<WatchTarget>(watchListPath);
  const watchTarget = packageToWatchTarget(storyPackage);

  const updatedWatchList = [
    watchTarget,
    ...watchList.filter((item) => item.id !== watchTarget.id),
  ];

  writeJson(watchListPath, updatedWatchList);

  return event;
}

export function rejectStory(storyPackage: StoryPackage) {
  const archive = readJson<StoryEvent>(archivePath);
  const event = packageToStoryEvent(storyPackage);

  event.status = "Archived";

  const updatedArchive = [
    event,
    ...archive.filter((item) => item.id !== event.id),
  ];

  writeJson(archivePath, updatedArchive);

  return event;
}

export function getStoryBank() {
  return readJson<StoryEvent>(bankPath);
}

export function getWatchList() {
  return readJson<WatchTarget>(watchListPath);
}

export function exportJimmyBufferTSV() {
  const bank = getStoryBank();

  const headers = [
    "Date Found",
    "Story Title",
    "Source Name",
    "Source URL",
    "Story Arc",
    "Story Type",
    "Hook",
    "Why Gamers Care",
    "Evidence Summary",
    "Content Score",
    "Time Score",
    "Freshness Status",
    "Recommended State",
    "Who Benefits",
    "Who Pays",
    "Ownership / Control Notes",
    "Talent Notes",
    "Tension Notes",
    "Consequence Notes",
    "Reason For Score",
    "Expiration Date",
    "Review Status",
    "Approved?",
    "Editor Notes",
  ];

  const rows = bank.map((story) => {
    const sourceNames = unique(story.articles.map((article) => article.source));
    const sourceUrls = unique(
      story.articles.map((article) => article.url || "")
    );

    const evidenceSummary = story.articles
      .map((article) => `${article.source}: ${article.title}`)
      .join(" | ");

    return [
      story.created_at,
      story.title,
      sourceNames.join(" | "),
      sourceUrls.join(" | "),
      story.story_arc,
      story.domain,
      story.real_story,
      story.why_gamers_care,
      evidenceSummary,
      story.content_score,
      story.time_score,
      story.freshness_status,
      story.recommended_state,
      story.who_benefits,
      story.who_pays,
      story.ownership_notes,
      story.talent_notes,
      story.tension_notes,
      story.consequence_notes,
      story.score_reasoning,
      story.expiration_date,
      "Needs Review",
      "",
      "",
    ].map(cleanCell);
  });

  return [headers, ...rows].map((row) => row.join("\t")).join("\n");
}