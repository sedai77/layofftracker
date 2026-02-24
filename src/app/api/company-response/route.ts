import { NextResponse } from "next/server";

import { consumeSubmissionRateLimit, insertCompanyResponse } from "@/lib/db";
import { getRequesterIp } from "@/lib/request-security";
import { companyResponseSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = companyResponseSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid response payload",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const requesterIp = getRequesterIp(request);
    const limit = consumeSubmissionRateLimit({
      channel: "company_response",
      requesterIp,
      maxPerHour: Number(process.env.COMPANY_RESPONSE_LIMIT_PER_HOUR ?? 4),
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many responses from this source. Try again later.",
        },
        {
          status: 429,
        },
      );
    }

    const id = insertCompanyResponse({
      company: data.company,
      statement: data.statement,
      contactEmail: data.contactEmail,
      referenceUrl: data.referenceUrl,
      moderationStatus: "pending",
    });

    return NextResponse.json(
      {
        ok: true,
        id,
        message:
          "Company response received and queued for moderator approval before publication.",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Unable to save company response",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
