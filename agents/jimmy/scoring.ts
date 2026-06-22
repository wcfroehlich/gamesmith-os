export function scoreStory(title: string) {
    let score = 50;
  
    const keywords = [
      "steam",
      "ownership",
      "pokemon",
      "ai",
      "creator",
      "twitch",
      "youtube",
      "nintendo",
      "playstation",
      "xbox",
    ];
  
    const titleLower = title.toLowerCase();
  
    keywords.forEach((keyword) => {
      if (titleLower.includes(keyword)) {
        score += 10;
      }
    });
  
    return Math.min(score, 100);
  }