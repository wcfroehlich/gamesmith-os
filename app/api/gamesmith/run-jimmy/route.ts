export async function GET() {
    const stories = [
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
      {
        title: "AI Tools Continue Changing Creator Workflows",
        source: "OpenAI News",
        storyArc: "AI & Creators",
        contentScore: 88,
        timeScore: 65,
        freshness: "Stable",
        recommended: "Banked",
        whyGamersCare:
          "Creators are using AI to speed up production, editing, and research.",
      },
    ];
  
    return Response.json({
      agent: "Jimmy",
      runAt: new Date().toISOString(),
      stories,
    });
  }