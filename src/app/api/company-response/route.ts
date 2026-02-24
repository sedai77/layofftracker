import { NextResponse } from "next/server";

import { insertCompanyResponse } from "@/lib/db";
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
    const id = insertCompanyResponse({
      company: data.company,
      statement: data.statement,
      contactEmail: data.contactEmail,
      referenceUrl: data.referenceUrl,
    });

    return NextResponse.json(
      {
        ok: true,
        id,
        message: "Company response received and queued for moderation.",
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
