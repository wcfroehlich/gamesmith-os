import Parser from "rss-parser";
import { Story } from "./types";
import { scoreStory } from "./scoring";
import { analyzeStory } from "./analyze";

const parser = new Parser();

export async function runJimmy(): Promise<Story[]> {
  try {
    const feed = await parser.parseURL(
      "https://blog.playstation.com/feed/"
    );

    const items = feed.items.slice(0, 5);

    const stories: Story[] = await Promise.all(
      items.map(async (item) => {
        const analysisRaw = await analyzeStory(
          item.title || "Untitled Story",
          item.contentSnippet || ""
        );
    
        const analysis = JSON.parse(analysisRaw || "{}");
    
        return {
          title: item.title || "Untitled Story",
          source: "PlayStation Blog",
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
    
    return stories;
  } catch (error) {
    console.error(error);

    return [
      {
        title: "Jimmy could not read PlayStation feed",
        source: "System",
        storyArc: "Other",
        contentScore: 0,
        timeScore: 0,
        freshness: "Expired",
        recommended: "Archive",
        whyGamersCare: "Feed retrieval failed.",
      },
    ];
  }
}