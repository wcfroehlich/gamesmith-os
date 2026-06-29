import { requireWorkspaceActor, jsonError } from "@/lib/canonical/identity";
import { transitionPackageTriage } from "@/lib/canonical/stories";

export async function POST(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request);
    const storyPackage = await request.json();
    const result = await transitionPackageTriage(actor, storyPackage, "maybe");

    return Response.json({
      ok: true,
      status: "Banked",
      result,
    });
  } catch (error) {
    return jsonError(error);
  }
}
