// ==================================================
// JIMMY AGENT
// Gamesmith Research Director
//
// v0.3 Mission:
// Find articles, package them into stories,
// enforce scoring rules, and present calibrated
// story packages to William.
// ==================================================

import fs from "fs";
import path from "path";
import Parser from "rss-parser";
import { analyzeStory } from "./analyze";
import { packageStories } from "./packageStories";
import { ArticleForPackaging, StoryPackage } from "./types-package";

const parser = new Parser();

type JimmySource = {
  name: string;
  url: string;
  tier: number;
  source_type: string;
  mission_fit: string[];
  authority_score: number;
  signal_score: number;
  noise_score: number;
  scan_frequency: string;
  active: boolean;
};

type JimmyMemoryItem = {
  url: string;
  title: string;
  source: string;
  dateSeen: string;
};

const sourcesPath = path.join(process.cwd(), "data", "gamesmith-sources.json");
const memoryPath = path.join(process.cwd(), "data", "jimmy-memory.json");

function loadSources(): JimmySource[] {
  const raw = fs.readFileSync(sourcesPath, "utf-8");

  return JSON.parse(raw)
    .filter((source: JimmySource) => source.active)
    .sort((a: JimmySource, b: JimmySource) => a.tier - b.tier);
}

function loadMemory(): JimmyMemoryItem[] {
  const raw = fs.readFileSync(memoryPath, "utf-8");
  return JSON.parse(raw);
}

function saveMemory(memory: JimmyMemoryItem[]) {
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}

function hasSeenStory(memory: JimmyMemoryItem[], url?: string) {
  if (!url) return false;
  return memory.some((item) => item.url === url);
}

function getStorySummary(item: Parser.Item) {
  return item.contentSnippet || item.content || item.summary || item.title || "";
}

export async function runJimmy(): Promise<StoryPackage[]> {
  const articleRecords: ArticleForPackaging[] = [];
  const sources = loadSources();
  const memory = loadMemory();

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 7);

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      const recentItems = feed.items.filter((item) => {
        if (!item.pubDate) return true;
        return new Date(item.pubDate) >= sinceDate;
      });

      const unseenItems = recentItems.filter((item) => {
        return !hasSeenStory(memory, item.link);
      });

      const items = unseenItems.slice(0, 10);

      const analyzedArticles: ArticleForPackaging[] = await Promise.all(
        items.map(async (item) => {
          const title = item.title || "Untitled Story";
          const summary = getStorySummary(item);
          const url = item.link || "";

          const analysisRaw = await analyzeStory(title, summary);
          const analysis = JSON.parse(analysisRaw || "{}");

          memory.push({
            url: url || title,
            title,
            source: source.name,
            dateSeen: new Date().toISOString(),
          });

          return {
            title,
            source: source.name,
            url,
            summary,
            storyArc: analysis.storyArc || source.mission_fit[0] || "Other",
            contentScore: analysis.contentScore || 0,
            timeScore: analysis.timeScore || 0,
            freshness: analysis.freshness || "Stable",
            recommended: analysis.recommended || "Archived",
            whyGamersCare:
              analysis.whyGamersCare ||
              summary ||
              "Potential impact on players.",
          };
        })
      );

      articleRecords.push(...analyzedArticles);
    } catch (error) {
      console.error(`Jimmy failed source: ${source.name}`, error);
    }
  }

  saveMemory(memory);

  const packages = await packageStories(articleRecords);

  packages.sort((a, b) => {
    if (b.content_scores.total !== a.content_scores.total) {
      return b.content_scores.total - a.content_scores.total;
    }

    return b.time_scores.total - a.time_scores.total;
  });

  return packages;
}