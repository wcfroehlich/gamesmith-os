import { jsonError, requireWorkspaceActor } from "@/lib/canonical/identity";

export async function POST(request: Request) {
  try {
    await requireWorkspaceActor(request);

    return Response.json(
      {
        success: false,
        message:
          "Discovery history is append-only after canonical cutover. Use a scoped admin operation such as reprocess source configuration, reopen a source item, or trigger a controlled backfill.",
      },
      { status: 410 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
