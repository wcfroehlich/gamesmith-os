import { rejectStory } from "@/lib/storyVault";

export async function POST(request: Request) {
  const storyPackage = await request.json();

  const rejectedStory = rejectStory(storyPackage);

  return Response.json({
    ok: true,
    status: "Archived",
    story: rejectedStory,
  });
}