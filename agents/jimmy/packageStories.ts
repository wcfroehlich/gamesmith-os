import OpenAI from "openai";
import {
  ArticleForPackaging,
  ContentScores,
  EditorialImportance,
  StoryPackage,
  TimeScores,
  TopDriver,
} from "./types-package";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function clampScore(value: unknown, min: number, max: number) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;

  const cleaned = value.trim();

  if (
    cleaned.toLowerCase() === "yes" ||
    cleaned.toLowerCase() === "no" ||
    cleaned.toLowerCase() === "true" ||
    cleaned.toLowerCase() === "false"
  ) {
    return fallback;
  }

  return cleaned || fallback;
}

function validateContentScores(scores: Partial<ContentScores>): ContentScores {
  const consumer_impact = clampScore(scores.consumer_impact, 0, 20);
  const consequences = clampScore(scores.consequences, 0, 20);
  const conflict_tension = clampScore(scores.conflict_tension, 0, 20);
  const ownership_control = clampScore(scores.ownership_control, 0, 15);
  const money_incentives = clampScore(scores.money_incentives, 0, 10);
  const talent_impact = clampScore(scores.talent_impact, 0, 10);
  const ecosystem_impact = clampScore(scores.ecosystem_impact, 0, 5);

  const total = clampScore(
    consumer_impact +
      consequences +
      conflict_tension +
      ownership_control +
      money_incentives +
      talent_impact +
      ecosystem_impact,
    0,
    100
  );

  return {
    consumer_impact,
    consequences,
    conflict_tension,
    ownership_control,
    money_incentives,
    talent_impact,
    ecosystem_impact,
    total,
  };
}

function validateTimeScores(scores: Partial<TimeScores>): TimeScores {
  const urgency = clampScore(scores.urgency, 0, 40);
  const shelf_life = clampScore(scores.shelf_life, 0, 30);
  const momentum = clampScore(scores.momentum, 0, 20);
  const follow_up_potential = clampScore(scores.follow_up_potential, 0, 10);

  const total = clampScore(
    urgency + shelf_life + momentum + follow_up_potential,
    0,
    100
  );

  return {
    urgency,
    shelf_life,
    momentum,
    follow_up_potential,
    total,
  };
}

function validateEditorialImportance(
  editorialImportance?: Partial<EditorialImportance>
): EditorialImportance {
  return {
    score: clampScore(editorialImportance?.score, 0, 20),
    reason: cleanText(editorialImportance?.reason, ""),
  };
}

function buildTopDrivers(contentScores: ContentScores): TopDriver[] {
  const drivers: TopDriver[] = [
    { label: "Consumer Impact", score: contentScores.consumer_impact, max: 20 },
    { label: "Consequences", score: contentScores.consequences, max: 20 },
    {
      label: "Conflict / Tension",
      score: contentScores.conflict_tension,
      max: 20,
    },
    {
      label: "Ownership / Control",
      score: contentScores.ownership_control,
      max: 15,
    },
    {
      label: "Money / Incentives",
      score: contentScores.money_incentives,
      max: 10,
    },
    { label: "Talent Impact", score: contentScores.talent_impact, max: 10 },
    { label: "Ecosystem Impact", score: contentScores.ecosystem_impact, max: 5 },
  ];

  return drivers.sort((a, b) => b.score / b.max - a.score / a.max).slice(0, 3);
}

function normalizePackage(storyPackage: Partial<StoryPackage>): StoryPackage {
  const contentScores = validateContentScores(storyPackage.content_scores || {});
  const timeScores = validateTimeScores(storyPackage.time_scores || {});
  const editorialImportance = validateEditorialImportance(
    storyPackage.editorial_importance
  );

  const articles = Array.isArray(storyPackage.articles)
    ? storyPackage.articles
    : [];

  const supportingSources = Array.isArray(storyPackage.supporting_sources)
    ? storyPackage.supporting_sources
    : [];

  const subEvents = Array.isArray(storyPackage.sub_events)
    ? storyPackage.sub_events
    : [];

  const articleCount = articles.length;

  const sourceCount =
    new Set(articles.map((article) => article.source).filter(Boolean)).size ||
    supportingSources.length ||
    1;

  const summary = cleanText(storyPackage.summary, "");
  const realStory = cleanText(storyPackage.real_story, summary);

  const survives =
    contentScores.total >= 70 && editorialImportance.score >= 10;

  return {
    story_title: cleanText(storyPackage.story_title, "Untitled Story Package"),
    package_type: cleanText(storyPackage.package_type, "Story Event"),

    gamesmith_story_type: cleanText(
      storyPackage.gamesmith_story_type,
      "Gaming Culture"
    ),
    secondary_story_type: cleanText(
      storyPackage.secondary_story_type,
      "None"
    ),

    real_story: realStory,
    story_arc: cleanText(storyPackage.story_arc, "Other"),
    summary,

    primary_source: cleanText(storyPackage.primary_source, "Unknown"),
    supporting_sources: supportingSources,
    sub_events: subEvents,

    content_scores: contentScores,
    time_scores: timeScores,
    editorial_importance: editorialImportance,

    top_drivers: buildTopDrivers(contentScores),

    freshness_status: cleanText(storyPackage.freshness_status, "Stable"),
    recommended_state: survives
      ? cleanText(storyPackage.recommended_state, "Review")
      : "Archived",
    expiration_estimate: cleanText(storyPackage.expiration_estimate, "Unknown"),

    why_gamers_care: cleanText(storyPackage.why_gamers_care, ""),
    who_benefits: cleanText(storyPackage.who_benefits, ""),
    who_pays: cleanText(storyPackage.who_pays, ""),
    ownership_notes: cleanText(storyPackage.ownership_notes, ""),
    talent_notes: cleanText(storyPackage.talent_notes, ""),
    tension_notes: cleanText(storyPackage.tension_notes, ""),
    consequence_notes: cleanText(storyPackage.consequence_notes, ""),
    score_reasoning: cleanText(storyPackage.score_reasoning, ""),
    recommended_use: cleanText(storyPackage.recommended_use, ""),

    verification_status: cleanText(
      storyPackage.verification_status,
      "Unverified"
    ),
    confidence_score: clampScore(storyPackage.confidence_score, 0, 100),
    sponsorship_risk: cleanText(storyPackage.sponsorship_risk, "Unknown"),
    bias_risk: cleanText(storyPackage.bias_risk, "Unknown"),

    article_count: articleCount,
    source_count: sourceCount,
    articles,
  };
}

export async function packageStories(
  articles: ArticleForPackaging[]
): Promise<StoryPackage[]> {
  if (articles.length === 0) {
    return [];
  }

  const prompt = `
You are Jimmy, the Gamesmith Research Director.

You do not present article spam.
You create Story Packages.

Use Jimmy Story Evaluation Rubric v1.0 exactly.

ABSOLUTE RULE:
real_story must be a complete sentence explaining the underlying Gamesmith narrative.
Never answer real_story with "Yes", "No", "True", "False", or a fragment.

GAMESMITH STORY TYPE:
Every package must have one primary gamesmith_story_type and one secondary_story_type.

Valid story types:
Consumer Rights
Game Ownership
Preservation
Right to Repair
Industry Labor
Corporate Power
Creator Economy
AI & Creators
Platform Policy
Gaming Culture
Design Philosophy
Monetization
Regulation & Government
TCG & Collectibles
Technology & Hardware

Examples:
- Steam Machine = primary Game Ownership, secondary Technology & Hardware
- Stop Killing Games = primary Game Ownership, secondary Consumer Rights
- Industry layoffs = primary Industry Labor, secondary Corporate Power
- Sea of Thieves player tools = primary Design Philosophy, secondary Gaming Culture
- AI in game development = primary AI & Creators, secondary Creator Economy
- Platform rule change = primary Platform Policy, secondary Consumer Rights

IMPORTANT OWNERSHIP CALIBRATION:
Consumer ownership must score higher than player agency.

High-value ownership includes:
- Digital ownership
- DRM
- Licensing
- Preservation
- Repair
- Platform lock-in
- Access removal
- Purchased game shutdown
- Hardware/software control

Player agency includes:
- Player creativity
- Customization
- Sandbox tools
- In-game control
- Cosmetic expression
- Gameplay freedom

Player agency is NOT the same as legal ownership.
Player agency should not receive maximum Ownership / Control unless it affects access, licensing, preservation, platform control, or consumer rights.

NEW EDITORIAL IMPORTANCE TEST:
After scoring Content and Time, answer this:
"If Gamesmith ignored this story entirely, what would be lost?"

This is not a clickbait test.
This is not an interest test.
This is an editorial importance test.

Editorial Importance scale:
0-5 = Interesting but disposable. Gamesmith loses almost nothing by ignoring it.
6-10 = Useful supporting material, but not episode-driving.
11-15 = Important Gamesmith coverage. Worth serious segment consideration.
16-20 = Core Gamesmith story. Ignoring it creates a major blind spot.

Calibration:
- Routine player agency features are usually 4-8 importance.
- Player agency is not the same as consumer rights.
- In-game control is not the same as legal ownership, licensing, access, repair, preservation, or platform control.
- Corporate anniversary posts are usually 0-5 unless tied to a concrete policy, pricing, platform, labor, ownership, or consumer-rights change.
- Sponsorship risk should be High only for sponsored, affiliate-heavy, advertorial, paid partnership, deal, or promotional content.
- Straight reporting from Game Developer, Ars, Verge, PC Gamer, Polygon, or official blogs is usually Low or Unknown sponsorship risk unless the article itself is promotional.
- Trend packages must have titles that explain the shared trend, not just list unrelated events.

Examples:
- Xbox anniversary / corporate vision piece: 0-5 unless tied to major consequence.
- Sea of Thieves feature update: usually 4-8 unless it changes actual ownership, access, licensing, preservation, or platform control.
- Steam Machine / SteamOS open ecosystem story: 11-15.
- Stop Killing Games / digital ownership / right to repair: 16-20.
- Labor and ownership trend affecting studios and workers: 11-15.

SURVIVAL RULE:
A package survives only if:
- content_scores.total >= 70
AND
- editorial_importance.score >= 10

If either is below threshold, recommend Archived.

CRITICAL SCORING LIMITS:
Content score category maximums:
- consumer_impact: 0-20
- consequences: 0-20
- conflict_tension: 0-20
- ownership_control: 0-15
- money_incentives: 0-10
- talent_impact: 0-10
- ecosystem_impact: 0-5
- total: 0-100

Time score category maximums:
- urgency: 0-40
- shelf_life: 0-30
- momentum: 0-20
- follow_up_potential: 0-10
- total: 0-100

You must never exceed category maximums.
The total must equal the sum of the category scores.

Package Types:
- Story Event: one event being reported by multiple sources
- Trend Analysis: multiple separate events that reveal a larger trend
- Story Arc Update: a new development inside a known long-running Gamesmith arc

Package Type Rules:
- If articles describe different events with a shared theme, use Trend Analysis.
- If articles describe one event with multiple details, use Story Event.
- If articles update a long-running Gamesmith arc, use Story Arc Update.
- Diablo backlash, GTA scams, and launcher revolt together are NOT one Story Event. They are a Trend Analysis or Story Arc Update.

Important calibration:
- Do not confuse interesting with important.
- Do not over-score corporate anniversary posts.
- Do not over-score routine feature updates.
- Ask what Gamesmith loses by ignoring the story.
- Use the full score range.
- Do not cluster everything at 70-80.

Required judgment:
- Determine whether this is a real story.
- Cluster related articles into packages.
- Do not score duplicate articles separately.
- Group all Steam Machine / SteamOS / Valve hardware pricing / consumer reaction stories together.
- If different events share a larger theme, use Trend Analysis.
- If the package updates a long-running Gamesmith topic, use Story Arc Update.
- Return only surviving packages.
- Return JSON only.
- Do not use markdown.
- Do not include text outside JSON.

Allowed package_type:
Story Event
Trend Analysis
Story Arc Update

Allowed freshness_status:
Hot
Warm
Stable
Aging
Expiring
Expired

Allowed recommended_state:
Review
Cover Now Candidate
Monitor
Banked
Archived

Allowed verification_status:
Confirmed
Likely
Unverified
Conflicting Reports
Rumor
Needs Origin Check

Allowed sponsorship_risk:
Low
Medium
High
Unknown

Allowed bias_risk:
Low
Medium
High
Unknown

Confidence score rules:
- Official primary source: 95-100
- Multiple major outlets with matching facts: 80-95
- Single reputable source: 60-80
- Unverified claim or unclear origin: 30-60
- Rumor: 0-50

Articles to package:
${JSON.stringify(articles, null, 2)}

Return this exact JSON shape:

{
  "packages": [
    {
      "story_title": "",
      "package_type": "",
      "gamesmith_story_type": "",
      "secondary_story_type": "",
      "real_story": "",
      "story_arc": "",
      "summary": "",
      "primary_source": "",
      "supporting_sources": [],
      "sub_events": [],
      "content_scores": {
        "consumer_impact": 0,
        "consequences": 0,
        "conflict_tension": 0,
        "ownership_control": 0,
        "money_incentives": 0,
        "talent_impact": 0,
        "ecosystem_impact": 0,
        "total": 0
      },
      "time_scores": {
        "urgency": 0,
        "shelf_life": 0,
        "momentum": 0,
        "follow_up_potential": 0,
        "total": 0
      },
      "editorial_importance": {
        "score": 0,
        "reason": ""
      },
      "top_drivers": [
        {
          "label": "",
          "score": 0,
          "max": 0
        }
      ],
      "freshness_status": "",
      "recommended_state": "",
      "expiration_estimate": "",
      "why_gamers_care": "",
      "who_benefits": "",
      "who_pays": "",
      "ownership_notes": "",
      "talent_notes": "",
      "tension_notes": "",
      "consequence_notes": "",
      "score_reasoning": "",
      "recommended_use": "",
      "verification_status": "",
      "confidence_score": 0,
      "sponsorship_risk": "",
      "bias_risk": "",
      "article_count": 0,
      "source_count": 0,
      "articles": [
        {
          "title": "",
          "source": "",
          "url": "",
          "summary": ""
        }
      ]
    }
  ]
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.1,
  });

  const raw = response.choices[0].message.content || "{\"packages\":[]}";
  const parsed = JSON.parse(raw);

  const packages = Array.isArray(parsed.packages) ? parsed.packages : [];

  return packages
    .map(normalizePackage)
    .filter(
      (storyPackage: StoryPackage) =>
        storyPackage.content_scores.total >= 70 &&
        storyPackage.editorial_importance.score >= 10
    );
}