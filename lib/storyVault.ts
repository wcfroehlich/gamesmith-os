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
    why_gamers_care: storyPackage.why_gamers_care,
    why_it_cannot_be_ignored: storyPackage.editorial_importance.reason,
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
    ...storyPackage.sub_events,
  ].filter(Boolean);

  return {
    id: slugify(`${storyPackage.story_arc}-${storyPackage.story_title}`),
    label: storyPackage.story_title,
    domain: storyPackage.gamesmith_story_type,
    story_arc: storyPackage.story_arc,
    search_mode: "Arc Watch",
    watch_terms: Array.from(new Set(watchTerms)),
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function bankStory(storyPackage: StoryPackage) {
  const bank = readJson<StoryEvent>(bankPath);
  const event = packageToStoryEvent(storyPackage);

  const updatedBank = [
    event,
    ...bank.filter((item) => item.id !== event.id),
  ];

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