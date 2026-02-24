import { NextRequest, NextResponse } from "next/server";

import { refreshDashboardCache } from "@/lib/dashboard-cache";
import {
  listCompanyResponsesForModeration,
  listImpactEventsForModeration,
  setCompanyResponseModeration,
  setImpactEventModeration,
} from "@/lib/db";
import { readBearerToken, secureTokenEquals } from "@/lib/request-security";
import { moderationActionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authorizeModerationRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const params = request.nextUrl.searchParams;
  const target = params.get("target") ?? "all";
  const status = normalizeModerationStatus(params.get("status"));
  const limit = normalizeLimit(params.get("limit"));

  if (target === "impact_event") {
    return NextResponse.json({
      ok: true,
      target,
      status,
      items: listImpactEventsForModeration(status, limit),
    });
  }

  if (target === "company_response") {
    return NextResponse.json({
      ok: true,
      target,
      status,
      items: listCompanyResponsesForModeration(status, limit),
    });
  }

  return NextResponse.json({
    ok: true,
    target: "all",
    status,
    impactEvents: listImpactEventsForModeration(status, limit),
    companyResponses: listCompanyResponsesForModeration(status, limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeModerationRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const parsed = moderationActionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid moderation payload",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { target, id, action, note } = parsed.data;
    const status = action === "approve" ? "approved" : "rejected";

    if (target === "impact_event") {
      const updated = setImpactEventModeration({
        id,
        status,
        note,
        moderatedBy: auth.moderatedBy,
      });

      if (!updated) {
        return NextResponse.json(
          {
            error: "Impact event not found",
          },
          { status: 404 },
        );
      }

      refreshDashboardCache();
    } else {
      const updated = setCompanyResponseModeration({
        id,
        status,
        note,
        moderatedBy: auth.moderatedBy,
      });

      if (!updated) {
        return NextResponse.json(
          {
            error: "Company response not found",
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      target,
      id,
      status,
      message: `Updated ${target} #${id} -> ${status}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Moderation request failed",
        message,
      },
      { status: 500 },
    );
  }
}

function authorizeModerationRequest(request: NextRequest): {
  ok: true;
  moderatedBy: string;
  response: null;
} | {
  ok: false;
  response: NextResponse;
} {
  const expectedToken = process.env.MODERATION_ADMIN_TOKEN;
  if (!expectedToken) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Moderation token not configured",
          message: "Set MODERATION_ADMIN_TOKEN in environment variables.",
        },
        { status: 503 },
      ),
    };
  }

  const tokenFromHeader = request.headers.get("x-admin-token")?.trim() ?? null;
  const tokenFromBearer = readBearerToken(request);
  const tokenFromQuery = request.nextUrl.searchParams.get("token")?.trim() ?? null;
  const providedToken = tokenFromHeader ?? tokenFromBearer ?? tokenFromQuery;

  if (!providedToken || !secureTokenEquals(providedToken, expectedToken)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 },
      ),
    };
  }

  const moderatedBy = request.headers.get("x-admin-id")?.trim() || "owner";

  return {
    ok: true,
    moderatedBy: moderatedBy.slice(0, 120),
    response: null,
  };
}

function normalizeModerationStatus(value: string | null): "pending" | "approved" | "rejected" {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
}

function normalizeLimit(value: string | null): number {
  const parsed = Number(value ?? 50);

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.max(1, Math.min(200, Math.floor(parsed)));
}
