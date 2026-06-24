import { bankStory } from "@/lib/storyVault";

export async function POST(request: Request) {
  const storyPackage = await request.json();

  const bankedStory = bankStory(storyPackage);

  return Response.json({
    ok: true,
    status: "Banked",
    story: bankedStory,
  });
}