import { getStoryBank, getWatchList } from "@/lib/storyVault";

export async function GET() {
  return Response.json({
    bank: await getStoryBank(),
    watchList: await getWatchList(),
  });
}