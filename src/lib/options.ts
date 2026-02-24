export const INDUSTRY_OPTIONS = [
  "Technology / SaaS",
  "Marketing & Media",
  "Finance & Accounting",
  "Customer Support",
  "Healthcare",
  "Manufacturing",
  "Education",
  "Legal",
  "Logistics",
  "Retail",
  "Public Sector",
  "Consulting",
] as const;

export const JOB_FUNCTION_OPTIONS = [
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "Customer Support",
  "Finance",
  "Human Resources",
  "Operations",
  "Legal",
  "Content",
  "Product",
  "Data",
] as const;

export const COUNTRY_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "India",
  "Singapore",
  "Australia",
  "Brazil",
  "Mexico",
  "Japan",
  "South Korea",
  "Netherlands",
  "Sweden",
  "Remote / Global",
] as const;

export const IMPACT_TYPE_OPTIONS = [
  "automation",
  "partial",
  "productivity",
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];
export type JobFunctionOption = (typeof JOB_FUNCTION_OPTIONS)[number];
export type CountryOption = (typeof COUNTRY_OPTIONS)[number];
export type ImpactType = (typeof IMPACT_TYPE_OPTIONS)[number];

export const DEFAULT_REGION_FOCUS = "United States";
export const DEFAULT_INDUSTRY_FOCUS = "Technology / SaaS";
