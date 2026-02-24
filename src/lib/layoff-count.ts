export interface LayoffCountEstimate {
  count: number;
  confidence: number;
  evidence: string;
}

const EXPLICIT_COUNT_PATTERNS: RegExp[] = [
  /\b(\d{1,3}(?:,\d{3})+|\d{1,6})\s+(?:employees|workers|jobs|staff|roles|positions|people)\b/i,
  /\b(?:laid\s+off|lays\s+off|lay\s+off|cut|cuts|eliminated|eliminate|reduced|reduce|fired)\s+(?:about|around|approximately|over|more\s+than|nearly|roughly)?\s*(\d{1,3}(?:,\d{3})+|\d{1,6})\b/i,
  /\b(\d{1,3}(?:,\d{3})+|\d{1,6})\s+job\s+cuts\b/i,
  /\b(?:layoffs?|reductions?)\s+of\s+(\d{1,3}(?:,\d{3})+|\d{1,6})\b/i,
];

const K_NOTATION_PATTERN = /\b(\d+(?:\.\d+)?)\s*k\s+(?:employees|workers|jobs|staff|roles|positions|people)\b/i;

const VAGUE_PATTERNS: Array<{ pattern: RegExp; value: number; confidence: number; label: string }> = [
  { pattern: /\bthousands\s+of\s+(?:employees|workers|jobs|staff|roles|positions|people)\b/i, value: 2000, confidence: 0.45, label: "thousands" },
  { pattern: /\bhundreds\s+of\s+(?:employees|workers|jobs|staff|roles|positions|people)\b/i, value: 200, confidence: 0.42, label: "hundreds" },
  { pattern: /\bdozens\s+of\s+(?:employees|workers|jobs|staff|roles|positions|people)\b/i, value: 24, confidence: 0.38, label: "dozens" },
  { pattern: /\ba\s+dozen\s+(?:employees|workers|jobs|staff|roles|positions|people)\b/i, value: 12, confidence: 0.36, label: "dozen" },
];

export function estimateLayoffCount(title: string, summary: string): LayoffCountEstimate {
  const text = `${title} ${summary}`.replace(/\s+/g, " ").trim();

  for (const pattern of EXPLICIT_COUNT_PATTERNS) {
    const match = text.match(pattern);
    const parsed = parseInteger(match?.[1]);

    if (parsed && parsed > 0) {
      return {
        count: parsed,
        confidence: 0.86,
        evidence: `explicit-number:${parsed}`,
      };
    }
  }

  const kMatch = text.match(K_NOTATION_PATTERN);
  if (kMatch?.[1]) {
    const parsed = Number(kMatch[1]);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return {
        count: Math.round(parsed * 1000),
        confidence: 0.72,
        evidence: `k-notation:${kMatch[1]}k`,
      };
    }
  }

  for (const item of VAGUE_PATTERNS) {
    if (item.pattern.test(text)) {
      return {
        count: item.value,
        confidence: item.confidence,
        evidence: `vague:${item.label}`,
      };
    }
  }

  return {
    count: 0,
    confidence: 0,
    evidence: "none",
  };
}

function parseInteger(value?: string): number {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}
