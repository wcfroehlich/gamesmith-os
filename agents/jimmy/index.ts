// ==================================================
// JIMMY AGENT
// Gamesmith Research Director
// ==================================================

import Parser from "rss-parser";
import { Story } from "./types";
import { analyzeStory } from "./analyze";
import { JIMMY_SOURCES } from "./sources";

const parser = new Parser();

export async function runJimmy(): Promise<Story[]> {
  const allStories: Story[] = [];

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 7);

  for (const source of JIMMY_SOURCES) {
    try {
      // STEP 1: Fetch one source
      const feed = await parser.parseURL(source.url);

      // STEP 2: Keep recent items only
      const recentItems = feed.items.filter((item) => {
        if (!item.pubDate) return true;
        return new Date(item.pubDate) >= sinceDate;
      });

      // STEP 3: Limit per source for speed/cost
      const items = recentItems.slice(0, 5);

      // STEP 4: Analyze with AI
      const analyzedStories: Story[] = await Promise.all(
        items.map(async (item) => {
          const analysisRaw = await analyzeStory(
            item.title || "Untitled Story",
            item.contentSnippet || ""
          );

          const analysis = JSON.parse(analysisRaw || "{}");

          return {
            title: item.title || "Untitled Story",
            source: source.name,
            storyArc: analysis.storyArc || "Other",
            contentScore: analysis.contentScore || 0,
            timeScore: analysis.timeScore || 0,
            freshness: analysis.freshness || "Stable",
            recommended: analysis.recommended || "Review",
            whyGamersCare:
              analysis.whyGamersCare ||
              item.contentSnippet ||
              "Potential impact on players.",
          };
        })
      );

      allStories.push(...analyzedStories);
    } catch (error) {
      console.error(`Jimmy failed source: ${source.name}`, error);

      allStories.push({
        title: `Jimmy could not read ${source.name}`,
        source: source.name,
        storyArc: "Other",
        contentScore: 0,
        timeScore: 0,
        freshness: "Expired",
        recommended: "Archive",
        whyGamersCare: "This source failed, but Jimmy kept running.",
      });
    }
  }

  allStories.sort((a, b) => b.contentScore - a.contentScore);

  return allStories;
}