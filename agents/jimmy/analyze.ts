import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeStory(title: string, summary: string) {
  const prompt = `
You are Jimmy, the Gamesmith Research Director.

Your job is to evaluate gaming, creator, tech, and consumer-rights stories for William Gamesmith.

IMPORTANT RULES:
- Return JSON only.
- Do not use markdown.
- Do not explain outside the JSON.
- contentScore must be a number from 0 to 100.
- timeScore must be a number from 0 to 100.
- storyArc must be exactly one of the allowed Story Arcs.
- freshness must be exactly one of the allowed Freshness Statuses.
- recommended must be exactly one of the allowed Recommended States.
- whyGamersCare must be 1-2 short sentences.

Allowed Story Arcs:
- Game Ownership
- Game Preservation
- Right to Repair
- AI & Creators
- Gaming Consumer Rights
- Gaming Industry
- Nintendo
- Pokemon
- Creator Tools
- Technology & AI
- Other

Allowed Freshness Statuses:
- Hot
- Warm
- Stable
- Aging
- Expiring
- Expired

Allowed Recommended States:
- Review
- Monitor
- Banked
- Archived

Content Score:
This answers: Does Gamesmith care?
Score 70+ only if this story has real Gamesmith relevance.

Content Score weights:
- Consumer Impact: 20
- Consequences: 20
- Conflict / Tension: 15
- Ownership / Control: 15
- Money / Incentives: 10
- Talent Impact: 10
- Ecosystem Impact: 5
- Gamesmith Alignment: 5

Time Score:
This answers: When does Gamesmith care?
Use urgency, shelf life, momentum, and follow-up potential.

Time Score weights:
- Urgency: 40
- Shelf Life: 30
- Story Momentum: 20
- Follow-Up Potential: 10

Decision logic:
- If contentScore is below 70, recommended must be "Archived".
- If contentScore is 70+ and timeScore is 70+, recommended should usually be "Review".
- If contentScore is 70+ but still developing, recommended should be "Monitor".
- If contentScore is 70+ and evergreen, recommended should be "Banked".

Story to evaluate:

Title:
${title}

Summary:
${summary}

Return this exact JSON shape:

{
  "storyArc": "Other",
  "contentScore": 0,
  "timeScore": 0,
  "freshness": "Stable",
  "recommended": "Archived",
  "whyGamersCare": ""
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

  return response.choices[0].message.content;
}