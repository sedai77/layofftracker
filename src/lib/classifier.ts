import {
  COUNTRY_OPTIONS,
  DEFAULT_REGION_FOCUS,
  INDUSTRY_OPTIONS,
  JOB_FUNCTION_OPTIONS,
  type CountryOption,
  type ImpactType,
  type IndustryOption,
  type JobFunctionOption,
} from "@/lib/options";

const AI_TERMS = [
  "ai",
  "artificial intelligence",
  "machine learning",
  "automation",
  "generative",
  "llm",
  "copilot",
  "chatgpt",
  "agentic",
];

const LAYOFF_TERMS = [
  "layoff",
  "layoffs",
  "job cuts",
  "cut jobs",
  "fired",
  "redundancies",
  "redundancy",
  "downsizing",
  "restructuring",
  "eliminate roles",
  "workforce reduction",
];

const PARTIAL_TERMS = [
  "partial replacement",
  "hybrid team",
  "team reduced",
  "role redesign",
  "reassigned",
  "reassignment",
  "smaller team",
  "headcount freeze",
  "redeploy",
  "realignment",
];

const PRODUCTIVITY_TERMS = [
  "productivity",
  "efficiency",
  "augment",
  "assist",
  "upskill",
  "reskill",
  "faster output",
  "higher throughput",
  "automation gains",
];

const INDUSTRY_KEYWORDS: Record<IndustryOption, string[]> = {
  "Technology / SaaS": [
    "software",
    "saas",
    "startup",
    "cloud",
    "platform",
    "app",
    "technology",
    "developer tools",
  ],
  "Marketing & Media": [
    "ad",
    "advertising",
    "marketing",
    "media",
    "content studio",
    "publishing",
    "brand",
  ],
  "Finance & Accounting": [
    "bank",
    "fintech",
    "accounting",
    "audit",
    "tax",
    "payment",
    "insurance",
  ],
  "Customer Support": [
    "support",
    "call center",
    "contact center",
    "help desk",
    "customer success",
    "service desk",
  ],
  Healthcare: [
    "hospital",
    "clinic",
    "healthcare",
    "medical",
    "pharma",
    "biotech",
    "health system",
  ],
  Manufacturing: [
    "factory",
    "manufacturing",
    "industrial",
    "automotive",
    "plant",
    "supply chain",
  ],
  Education: [
    "education",
    "school",
    "university",
    "edtech",
    "learning",
    "college",
  ],
  Legal: [
    "law firm",
    "legal",
    "paralegal",
    "contract review",
    "compliance",
  ],
  Logistics: [
    "logistics",
    "shipping",
    "warehouse",
    "freight",
    "delivery",
  ],
  Retail: [
    "retail",
    "ecommerce",
    "store",
    "merchandising",
    "consumer",
  ],
  "Public Sector": [
    "government",
    "public sector",
    "municipal",
    "federal",
    "state agency",
  ],
  Consulting: [
    "consulting",
    "advisory",
    "professional services",
    "outsourcing",
  ],
};

const ROLE_KEYWORDS: Record<JobFunctionOption, string[]> = {
  Engineering: [
    "engineer",
    "developer",
    "programmer",
    "software team",
    "devops",
  ],
  Design: ["designer", "ux", "ui", "creative", "graphic design"],
  Marketing: [
    "marketing",
    "campaign",
    "growth",
    "seo",
    "social media",
  ],
  Sales: ["sales", "account executive", "business development", "pipeline"],
  "Customer Support": [
    "support",
    "customer service",
    "call center",
    "help desk",
  ],
  Finance: ["finance", "accounting", "bookkeeping", "analyst", "treasury"],
  "Human Resources": ["hr", "recruiter", "talent", "people ops"],
  Operations: ["operations", "ops", "workflow", "back office", "procurement"],
  Legal: ["legal", "lawyer", "paralegal", "contract"],
  Content: ["content", "copywriter", "editor", "writer", "journalist"],
  Product: ["product manager", "product team", "roadmap", "pm"],
  Data: ["data", "analyst", "analytics", "bi", "data science"],
};

const COUNTRY_KEYWORDS: Partial<Record<CountryOption, string[]>> = {
  "United States": ["united states", "u.s.", "us ", "american", "silicon valley"],
  Canada: ["canada", "canadian"],
  "United Kingdom": ["united kingdom", "uk ", "britain", "british", "london"],
  Germany: ["germany", "german", "berlin", "munich"],
  France: ["france", "french", "paris"],
  Spain: ["spain", "spanish", "madrid"],
  Italy: ["italy", "italian", "milan"],
  India: ["india", "indian", "bengaluru", "bangalore", "hyderabad"],
  Singapore: ["singapore"],
  Australia: ["australia", "sydney", "melbourne"],
  Brazil: ["brazil", "brazilian", "sao paulo"],
  Mexico: ["mexico", "mexican"],
  Japan: ["japan", "japanese", "tokyo"],
  "South Korea": ["south korea", "korea", "seoul"],
  Netherlands: ["netherlands", "dutch", "amsterdam"],
  Sweden: ["sweden", "stockholm", "swedish"],
  "Remote / Global": ["remote", "global", "worldwide"],
};

export interface ClassifiedSignal {
  isRelevant: boolean;
  industry: IndustryOption;
  jobFunction: JobFunctionOption;
  country: CountryOption;
  impactType: ImpactType;
  severityScore: number;
  confidence: number;
  company: string | null;
}

export function classifySignal(title: string, summary: string): ClassifiedSignal {
  const fullText = `${title} ${summary}`.replace(/\s+/g, " ").trim();
  const lower = fullText.toLowerCase();

  const aiHits = countHits(lower, AI_TERMS);
  const layoffHits = countHits(lower, LAYOFF_TERMS);
  const partialHits = countHits(lower, PARTIAL_TERMS);
  const productivityHits = countHits(lower, PRODUCTIVITY_TERMS);

  const hasAiContext = aiHits > 0;
  const hasImpactContext = layoffHits + partialHits + productivityHits > 0;

  const isRelevant = hasAiContext && hasImpactContext;

  const industry = pickCategory(lower, INDUSTRY_KEYWORDS, "Technology / SaaS");
  const jobFunction = pickCategory(lower, ROLE_KEYWORDS, "Operations");
  const country = pickCategory(lower, COUNTRY_KEYWORDS, DEFAULT_REGION_FOCUS);
  const impactType = inferImpactType({
    layoffHits,
    partialHits,
    productivityHits,
  });

  const severityScore = inferSeverity(impactType, lower);
  const confidence = inferConfidence({
    aiHits,
    layoffHits,
    partialHits,
    productivityHits,
  });

  return {
    isRelevant,
    industry,
    jobFunction,
    country,
    impactType,
    severityScore,
    confidence,
    company: extractCompany(title),
  };
}

export function isLayoffReportCandidate(title: string, summary: string): boolean {
  const lower = `${title} ${summary}`.toLowerCase();

  if (countHits(lower, LAYOFF_TERMS) > 0) {
    return true;
  }

  return /\b(workforce|headcount)\s+(cut|cuts|reduction|reduced|drop)\b/i.test(lower);
}

function countHits(text: string, terms: readonly string[]): number {
  return terms.reduce((count, term) => {
    if (text.includes(term)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function pickCategory<T extends string>(
  text: string,
  categories: Partial<Record<T, string[]>>,
  fallback: T,
): T {
  let bestScore = -1;
  let bestCategory: T = fallback;

  for (const [category, keywords] of Object.entries(categories) as Array<
    [T, string[]]
  >) {
    const score = keywords.reduce(
      (accumulator, keyword) =>
        text.includes(keyword) ? accumulator + keyword.length : accumulator,
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function inferImpactType(input: {
  layoffHits: number;
  partialHits: number;
  productivityHits: number;
}): ImpactType {
  if (
    input.productivityHits > input.layoffHits &&
    input.productivityHits >= input.partialHits
  ) {
    return "productivity";
  }

  if (input.partialHits > 0 && input.layoffHits === 0) {
    return "partial";
  }

  if (input.partialHits > input.layoffHits && input.partialHits > 1) {
    return "partial";
  }

  return "automation";
}

function inferSeverity(impactType: ImpactType, text: string): number {
  const baseScore: Record<ImpactType, number> = {
    automation: 76,
    partial: 58,
    productivity: 34,
  };

  let modifier = 0;

  if (text.includes("mass") || text.includes("major") || text.includes("wave")) {
    modifier += 10;
  }

  if (text.includes("hundreds") || text.includes("thousands")) {
    modifier += 8;
  }

  if (text.includes("pilot") || text.includes("experiment")) {
    modifier -= 6;
  }

  if (impactType === "productivity") {
    modifier -= 4;
  }

  return clamp(baseScore[impactType] + modifier, 5, 100);
}

function inferConfidence(input: {
  aiHits: number;
  layoffHits: number;
  partialHits: number;
  productivityHits: number;
}): number {
  const impactHits = input.layoffHits + input.partialHits + input.productivityHits;
  const score = 0.42 + input.aiHits * 0.1 + impactHits * 0.08;
  return Number(clamp(score, 0.35, 0.95).toFixed(2));
}

function extractCompany(title: string): string | null {
  const normalized = title.replace(/\s+/g, " ").trim();

  const leadingPattern = normalized.match(
    /^([A-Z][A-Za-z0-9&'.\-\s]{1,60})\s(?:announces|plans|cuts|lays off|layoffs|automation|restructures)/,
  );
  if (leadingPattern?.[1]) {
    return cleanCompanyName(leadingPattern[1]);
  }

  const atPattern = normalized.match(/\bat\s([A-Z][A-Za-z0-9&'.\-\s]{1,60})/);
  if (atPattern?.[1]) {
    return cleanCompanyName(atPattern[1]);
  }

  return null;
}

function cleanCompanyName(value: string): string | null {
  const cleaned = value
    .replace(/\b(the|a|an)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2) {
    return null;
  }

  const wordCount = cleaned.split(" ").length;
  if (wordCount > 4) {
    return null;
  }

  if (
    /\b(thinks|says|warns|confirms|explains|blamed|blaming|because)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }

  return cleaned.slice(0, 80);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isValidIndustry(value: string): value is IndustryOption {
  return INDUSTRY_OPTIONS.includes(value as IndustryOption);
}

export function isValidJobFunction(value: string): value is JobFunctionOption {
  return JOB_FUNCTION_OPTIONS.includes(value as JobFunctionOption);
}

export function isValidCountry(value: string): value is CountryOption {
  return COUNTRY_OPTIONS.includes(value as CountryOption);
}
