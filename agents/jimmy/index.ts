// ==================================================
// JIMMY AGENT
// Gamesmith Research Director
//
// v1.0 Mission:
// Discover new story events,
// package them into editorial intelligence,
// and prepare them for William's review.
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
  source_role?: string;
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

type JimmyConfig = {
  bootstrapMode: boolean;
  bootstrapStartDate: string;
  maintenanceDays: number;
  maxItemsPerSource: number;
  includePredictiveSources: boolean;
};

const sourcesPath = path.join(process.cwd(), "data", "gamesmith-sources.json");
const memoryPath = path.join(process.cwd(), "data", "jimmy-memory.json");
const configPath = path.join(process.cwd(), "data", "jimmy-config.json");

function loadConfig(): JimmyConfig {
  if (!fs.existsSync(configPath)) {
    return {
      bootstrapMode: false,
      bootstrapStartDate: "2026-01-01",
      maintenanceDays: 7,
      maxItemsPerSource: 10,
      includePredictiveSources: false,
    };
  }

  const raw = fs.readFileSync(configPath, "utf-8");

  return {
    bootstrapMode: false,
    bootstrapStartDate: "2026-01-01",
    maintenanceDays: 7,
    maxItemsPerSource: 10,
    includePredictiveSources: false,
    ...JSON.parse(raw),
  };
}

function loadSources(config: JimmyConfig): JimmySource[] {
  const raw = fs.readFileSync(sourcesPath, "utf-8");

  return JSON.parse(raw)
    .filter((source: JimmySource) => source.active)
    .filter((source: JimmySource) => {
      if (config.includePredictiveSources) return true;
      return source.source_role !== "predictive";
    })
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

function getSinceDate(config: JimmyConfig) {
  if (config.bootstrapMode) {
    return new Date(config.bootstrapStartDate);
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - config.maintenanceDays);
  return sinceDate;
}

function getItemDate(item: Parser.Item) {
  const dateText = item.isoDate || item.pubDate;

  if (!dateText) {
    return null;
  }

  const itemDate = new Date(dateText);

  if (Number.isNaN(itemDate.getTime())) {
    return null;
  }

  return itemDate;
}

export async function runJimmy(): Promise<StoryPackage[]> {
  const config = loadConfig();
  const articleRecords: ArticleForPackaging[] = [];
  const sources = loadSources(config);
  const memory = loadMemory();
  const sinceDate = getSinceDate(config);

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      const recentItems = feed.items.filter((item) => {
        const itemDate = getItemDate(item);

        if (!itemDate) return true;

        return itemDate >= sinceDate;
      });

      const unseenItems = recentItems.filter((item) => {
        return !hasSeenStory(memory, item.link);
      });

      const items = unseenItems.slice(0, config.maxItemsPerSource);

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
    if (b.editorial_importance.score !== a.editorial_importance.score) {
      return b.editorial_importance.score - a.editorial_importance.score;
    }

    if (b.content_scores.total !== a.content_scores.total) {
      return b.content_scores.total - a.content_scores.total;
    }

    return b.time_scores.total - a.time_scores.total;
  });

  return packages;
}