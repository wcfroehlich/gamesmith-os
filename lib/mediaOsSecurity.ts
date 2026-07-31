export type DiscoveryRequest = {
  workspace_id: string;
  production_id: string;
  idempotency_key: string;
  branch: "gaming";
  coverage_start?: string;
  coverage_end?: string;
  cost_cap_usd: number;
  dry_run: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function bearerToken(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const value = header.slice(7).trim();
  return value.length >= 20 ? value : null;
}

export function parseDiscoveryRequest(raw: unknown): DiscoveryRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("INVALID_REQUEST");
  }
  const value = raw as Record<string, unknown>;
  const workspaceId = String(value.workspace_id || "");
  const productionId = String(value.production_id || "");
  const key = String(value.idempotency_key || "");
  const branch = String(value.branch || "").toLowerCase();
  const cap = Number(value.cost_cap_usd);
  const start = value.coverage_start ? String(value.coverage_start) : undefined;
  const end = value.coverage_end ? String(value.coverage_end) : undefined;

  if (!UUID.test(workspaceId) || !UUID.test(productionId)) throw new Error("INVALID_ID");
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  if (branch !== "gaming") throw new Error("UNSUPPORTED_BRANCH");
  if (!Number.isFinite(cap) || cap < 0 || cap > 5) throw new Error("INVALID_COST_CAP");
  if ((start && !ISO_DATE.test(start)) || (end && !ISO_DATE.test(end))) {
    throw new Error("INVALID_COVERAGE_DATE");
  }
  if (start && end && start > end) throw new Error("INVALID_COVERAGE_WINDOW");

  return {
    workspace_id: workspaceId,
    production_id: productionId,
    idempotency_key: key,
    branch: "gaming",
    coverage_start: start,
    coverage_end: end,
    cost_cap_usd: Math.round(cap * 10000) / 10000,
    dry_run: value.dry_run === true,
  };
}

export function publicError(error: unknown): { code: string; message: string } {
  const code = error instanceof Error && /^[A-Z_]+$/.test(error.message)
    ? error.message
    : "DISCOVERY_FAILED";
  const messages: Record<string, string> = {
    INVALID_REQUEST: "The request body is invalid.",
    INVALID_ID: "A workspace or production identifier is invalid.",
    INVALID_IDEMPOTENCY_KEY: "A valid idempotency key is required.",
    UNSUPPORTED_BRANCH: "Only the gaming discovery branch is available.",
    INVALID_COST_CAP: "The request cost cap is invalid.",
    INVALID_COVERAGE_DATE: "Coverage dates must use YYYY-MM-DD.",
    INVALID_COVERAGE_WINDOW: "The coverage start must not be after the end.",
    DISCOVERY_FAILED: "Discovery failed safely. No retry was started.",
  };
  return { code, message: messages[code] || messages.DISCOVERY_FAILED };
}
