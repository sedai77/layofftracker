import { formatDistanceToNowStrict } from "date-fns";

import type { ImpactType } from "@/lib/options";

export function formatImpactLabel(impactType: ImpactType): string {
  if (impactType === "automation") {
    return "AI automation";
  }

  if (impactType === "partial") {
    return "Partial replacement";
  }

  return "Productivity boost";
}

export function formatRelativeDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.valueOf())) {
    return "unknown";
  }

  return `${formatDistanceToNowStrict(parsed, { addSuffix: true })}`;
}

export function pctLabel(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}
