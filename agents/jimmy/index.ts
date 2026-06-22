import { Story } from "./types";

export async function runJimmy(): Promise<Story[]> {
  return [
    {
      title: "Steam Ownership Debate Heats Up Again",
      source: "Steam News",
      storyArc: "Game Ownership",
      contentScore: 92,
      timeScore: 81,
      freshness: "Hot",
      recommended: "Review",
      whyGamersCare:
        "This affects what players actually own when they buy digital games.",
    },
    {
      title: "Pokemon Card Retailers Tighten Purchase Limits",
      source: "Retail / Pokemon",
      storyArc: "Pokemon",
      contentScore: 84,
      timeScore: 72,
      freshness: "Warm",
      recommended: "Monitor",
      whyGamersCare:
        "Scalpers and reseller policies affect normal fans trying to buy cards.",
    },
  ];
}