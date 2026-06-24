import { exportJimmyBufferTSV } from "@/lib/storyVault";

export async function GET() {
  const tsv = exportJimmyBufferTSV();

  return new Response(tsv, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
    },
  });
}