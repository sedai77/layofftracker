import { z } from "zod";

import {
  COUNTRY_OPTIONS,
  IMPACT_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  JOB_FUNCTION_OPTIONS,
} from "@/lib/options";

export const submissionSchema = z.object({
  company: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
  industry: z.enum(INDUSTRY_OPTIONS),
  jobFunction: z.enum(JOB_FUNCTION_OPTIONS),
  country: z.enum(COUNTRY_OPTIONS),
  impactType: z.enum(IMPACT_TYPE_OPTIONS),
  title: z.string().trim().min(12).max(220),
  summary: z.string().trim().min(25).max(1800),
  sourceUrl: z
    .string()
    .trim()
    .url()
    .max(400)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  reportedAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
});

export const companyResponseSchema = z.object({
  company: z.string().trim().min(2).max(120),
  statement: z.string().trim().min(25).max(2000),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(180)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  referenceUrl: z
    .string()
    .trim()
    .url()
    .max(400)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
});

export const moderationActionSchema = z.object({
  target: z.enum(["impact_event", "company_response"]),
  id: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
export type CompanyResponseInput = z.infer<typeof companyResponseSchema>;
export type ModerationActionInput = z.infer<typeof moderationActionSchema>;
