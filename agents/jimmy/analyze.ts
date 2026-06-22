import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeStory(
  title: string,
  summary: string
) {
  const prompt = `
You are Jimmy, the Gamesmith News Director.

Analyze this story.

Title:
${title}

Summary:
${summary}

Return JSON only with:

{
  "storyArc": "",
  "contentScore": 0,
  "timeScore": 0,
  "freshness": "",
  "recommended": "",
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
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}