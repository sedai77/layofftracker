"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Clock3,
  Globe2,
  Radar,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import {
  COUNTRY_OPTIONS,
  DEFAULT_REGION_FOCUS,
  INDUSTRY_OPTIONS,
  JOB_FUNCTION_OPTIONS,
} from "@/lib/options";
import { formatImpactLabel, formatRelativeDate, pctLabel } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

interface RadarDashboardProps {
  initialData: DashboardData;
}

interface SubmissionFormState {
  company: string;
  industry: string;
  jobFunction: string;
  country: string;
  impactType: string;
  title: string;
  summary: string;
  sourceUrl: string;
  reportedAt: string;
}

interface CompanyResponseState {
  company: string;
  statement: string;
  contactEmail: string;
  referenceUrl: string;
}

const initialSubmissionState: SubmissionFormState = {
  company: "",
  industry: "Technology / SaaS",
  jobFunction: "Operations",
  country: DEFAULT_REGION_FOCUS,
  impactType: "automation",
  title: "",
  summary: "",
  sourceUrl: "",
  reportedAt: "",
};

const initialCompanyResponseState: CompanyResponseState = {
  company: "",
  statement: "",
  contactEmail: "",
  referenceUrl: "",
};

export function RadarDashboard({ initialData }: RadarDashboardProps) {
  const [dashboard, setDashboard] = useState(initialData);
  const [countryFilter, setCountryFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submission, setSubmission] = useState(initialSubmissionState);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [companyResponse, setCompanyResponse] = useState(initialCompanyResponseState);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const refreshData = useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (countryFilter !== "All") {
        params.set("country", countryFilter);
      }
      if (industryFilter !== "All") {
        params.set("industry", industryFilter);
      }

      try {
        const response = await fetch(`/api/dashboard?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Dashboard request failed (${response.status})`);
        }

        const payload = (await response.json()) as DashboardData;
        setDashboard(payload);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to refresh dashboard";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [countryFilter, industryFilter],
  );

  useEffect(() => {
    void refreshData(false);
  }, [refreshData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshData(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshData]);

  const countries = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set([...dashboard.availableCountries, ...COUNTRY_OPTIONS]),
      ).sort((left, right) => left.localeCompare(right)),
    ],
    [dashboard.availableCountries],
  );

  const industries = useMemo(
    () => ["All", ...dashboard.availableIndustries],
    [dashboard.availableIndustries],
  );

  const handleSubmitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmissionStatus(null);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submission),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit report");
      }

      setSubmissionStatus(payload.message ?? "Submission accepted.");
      setSubmission(initialSubmissionState);
      void refreshData(true);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to submit";
      setSubmissionStatus(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCompanyResponse = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSubmittingResponse(true);
    setCompanyStatus(null);

    try {
      const response = await fetch("/api/company-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyResponse),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit company response");
      }

      setCompanyStatus(payload.message ?? "Company response submitted.");
      setCompanyResponse(initialCompanyResponseState);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to submit";
      setCompanyStatus(message);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const velocityLabel = pctLabel(dashboard.summary.velocityDeltaPct);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#031126] text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_15%_20%,rgba(16,185,129,.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,.2),transparent_40%),radial-gradient(circle_at_70%_70%,rgba(245,158,11,.18),transparent_32%)]" />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-10 md:py-12">
        <header className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-900/65 p-6 shadow-2xl backdrop-blur-xl md:p-10">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -bottom-20 left-20 h-44 w-44 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-200">
                <Radar className="h-4 w-4" /> AI Layoff Radar
              </p>
              <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-rose-200">
                  Estimated people fired in AI-related layoffs
                </p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-4xl font-semibold leading-none text-white md:text-5xl">
                    {dashboard.summary.peopleFiredTotal.toLocaleString()}
                  </p>
                  <p className="pb-1 text-sm text-rose-100">
                    people in this filtered view
                  </p>
                </div>
                {dashboard.summary.layoffReportsWithoutHeadcount > 0 && (
                  <p className="mt-1 text-xs text-rose-100/90">
                    {dashboard.summary.layoffReportsWithoutHeadcount.toLocaleString()} layoff reports
                    have no headcount disclosed.
                  </p>
                )}
              </div>
              <h1 className="font-serif text-3xl leading-tight text-white md:text-5xl">
                Real-time AI impact tracker for jobs, industries, and workforce
                velocity.
              </h1>
              <p className="max-w-2xl text-sm text-slate-200 md:text-base">
                Signals are aggregated from public news and self-reports. This index
                is updated hourly and designed for trend detection, not blame.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-cyan-100 md:text-sm">
                <Tag icon={<ShieldAlert className="h-3.5 w-3.5" />} text="Self-reported + verified-source blend" />
                <Tag icon={<Clock3 className="h-3.5 w-3.5" />} text="Hourly ingestion pipeline" />
                <Tag icon={<Globe2 className="h-3.5 w-3.5" />} text="No login required" />
              </div>
            </div>

            <div className="grid w-full max-w-xl grid-cols-2 gap-3 text-xs md:text-sm">
              <StatTile
                icon={<AlertTriangle className="h-4 w-4 text-rose-300" />}
                label="People Fired"
                value={dashboard.summary.peopleFiredTotal.toLocaleString()}
                note="Estimated total"
              />
              <StatTile
                icon={<TrendingUp className="h-4 w-4 text-amber-300" />}
                label="AI Velocity"
                value={`${dashboard.summary.currentVelocity.toFixed(1)}`}
                note={velocityLabel}
                highlight={dashboard.summary.velocityDeltaPct >= 0}
              />
              <StatTile
                icon={<Sparkles className="h-4 w-4 text-cyan-300" />}
                label="Avg Risk Index"
                value={`${dashboard.summary.averageRisk}`}
                note="Role-weighted"
              />
              <StatTile
                icon={<Building2 className="h-4 w-4 text-emerald-300" />}
                label="Coverage"
                value={`${dashboard.summary.industriesTracked} industries`}
                note={`${dashboard.summary.countriesTracked} countries`}
              />
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <NumberBoardTile
            label="Total People Fired"
            value={dashboard.summary.peopleFiredTotal.toLocaleString()}
            note="AI-attributed layoffs, last 240 days"
          />
          <NumberBoardTile
            label="People Fired This Month"
            value={dashboard.summary.peopleFiredThisMonth.toLocaleString()}
            note="Month-to-date estimate"
          />
          <NumberBoardTile
            label="People Fired (30 Days)"
            value={dashboard.summary.peopleFiredLast30Days.toLocaleString()}
            note="Rolling 30-day estimate"
          />
          <NumberBoardTile
            label="People Fired (7 Days)"
            value={dashboard.summary.peopleFiredLast7Days.toLocaleString()}
            note="Rolling weekly estimate"
          />
          <NumberBoardTile
            label="Top Impacted Industry"
            value={dashboard.summary.topLayoffIndustryPeopleFired.toLocaleString()}
            note={dashboard.summary.topLayoffIndustry ?? "No layoff industry yet"}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200/10 bg-slate-900/55 p-4 backdrop-blur-lg md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:w-[520px]">
              <label className="text-xs text-slate-300">
                Region focus
                <select
                  value={countryFilter}
                  onChange={(event) => setCountryFilter(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-cyan-300/30 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-200"
                >
                  {countries.map((country) => (
                    <option key={country} value={country} className="bg-slate-950">
                      {country}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Industry focus
                <select
                  value={industryFilter}
                  onChange={(event) => setIndustryFilter(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-cyan-300/30 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-200"
                >
                  {industries.map((industry) => (
                    <option key={industry} value={industry} className="bg-slate-950">
                      {industry}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="text-xs text-slate-300 md:text-right">
              <p>
                Last ingestion: {" "}
                <span className="text-slate-100">
                  {dashboard.lastIngestedAt
                    ? formatRelativeDate(dashboard.lastIngestedAt)
                    : "pending first run"}
                </span>
              </p>
              <p>
                Dashboard refresh: {" "}
                <span className="text-slate-100">
                  {formatRelativeDate(dashboard.generatedAt)}
                </span>
              </p>
            </div>
          </div>

          {loading && (
            <p className="mt-3 text-xs text-cyan-200">Refreshing dashboard...</p>
          )}

          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel title="Monthly AI-attributed layoffs" subtitle="Automation + partial replacement trend">
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={dashboard.monthlyTrend}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(148,163,184,.35)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="layoffs"
                  stroke="#fb7185"
                  strokeWidth={2.8}
                  dot={{ r: 3 }}
                  name="Layoff pressure"
                />
                <Line
                  type="monotone"
                  dataKey="productivity"
                  stroke="#4ade80"
                  strokeWidth={2.4}
                  dot={{ r: 2 }}
                  name="Productivity signals"
                />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Replacement velocity" subtitle="Weighted weekly acceleration index">
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart data={dashboard.weeklyVelocity}>
                <defs>
                  <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(148,163,184,.35)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#fbbf24"
                  strokeWidth={2.8}
                  fill="url(#velocityFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Industry AI Risk Index" subtitle="Score blends severity + signal concentration">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dashboard.industryRiskIndex} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="#94a3b8"
                  width={130}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(148,163,184,.35)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
                <Bar dataKey="score" radius={[0, 10, 10, 0]}>
                  {dashboard.industryRiskIndex.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={entry.score >= 70 ? "#f97316" : entry.score >= 50 ? "#eab308" : "#38bdf8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Role vulnerability score" subtitle="Function-level exposure across tracked reports">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dashboard.roleVulnerability}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={65} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(148,163,184,.35)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
                <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                  {dashboard.roleVulnerability.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={entry.score >= 70 ? "#fb7185" : entry.score >= 50 ? "#f59e0b" : "#22d3ee"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Panel title="Geographic heatmap" subtitle="Country-level AI displacement intensity">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {dashboard.countryHeatmap.length === 0 && (
                <p className="text-sm text-slate-300">No country data yet.</p>
              )}

              {dashboard.countryHeatmap.map((country) => {
                const opacity = Math.max(0.2, country.score / 100);
                return (
                  <article
                    key={country.country}
                    className="rounded-xl border border-slate-200/10 p-3"
                    style={{
                      backgroundColor: `rgba(251, 146, 60, ${opacity * 0.32})`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-100">
                        {country.country}
                      </h4>
                      <span className="text-xs text-slate-200">{country.score}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-200">
                      {country.signals} tracked signals
                    </p>
                  </article>
                );
              })}
            </div>
          </Panel>

          <Panel title="Latest stories" subtitle="Public links + self-reported entries">
            <div className="space-y-3">
              {dashboard.stories.length === 0 && (
                <p className="text-sm text-slate-300">No events yet. Submit the first report below.</p>
              )}

              {dashboard.stories.map((story) => (
                <article
                  key={story.id}
                  className="rounded-xl border border-slate-200/10 bg-slate-950/45 p-3"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                      {formatImpactLabel(story.impactType)}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200">
                      {story.industry}
                    </span>
                    <span className="text-[11px] text-slate-300">
                      {formatRelativeDate(story.reportedAt)}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-white">{story.title}</h4>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-200">{story.summary}</p>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                    <span>{story.sourceName}</span>
                    {story.sourceUrl ? (
                      <a
                        href={story.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-200 transition hover:text-cyan-100"
                      >
                        Source <ArrowUpRight className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>Self-reported</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel
            title="Submit an AI impact signal"
            subtitle="Public, no-login, moderated aggregation. Keep entries factual."
          >
            <form className="grid gap-3" onSubmit={handleSubmitReport}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Company (optional)"
                  value={submission.company}
                  onChange={(value) =>
                    setSubmission((state) => ({ ...state, company: value }))
                  }
                />
                <Field
                  label="Country"
                  value={submission.country}
                  onChange={(value) =>
                    setSubmission((state) => ({ ...state, country: value }))
                  }
                  as="select"
                  options={countries.filter((country) => country !== "All")}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Industry"
                  value={submission.industry}
                  onChange={(value) =>
                    setSubmission((state) => ({ ...state, industry: value }))
                  }
                  as="select"
                  options={dashboard.availableIndustries}
                  fallbackOptions={[...INDUSTRY_OPTIONS]}
                />
                <Field
                  label="Job function"
                  value={submission.jobFunction}
                  onChange={(value) =>
                    setSubmission((state) => ({ ...state, jobFunction: value }))
                  }
                  as="select"
                  options={dashboard.roleVulnerability.map((item) => item.label)}
                  fallbackOptions={[...JOB_FUNCTION_OPTIONS]}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Impact type"
                  value={submission.impactType}
                  onChange={(value) =>
                    setSubmission((state) => ({ ...state, impactType: value }))
                  }
                  as="select"
                  options={["automation", "partial", "productivity"]}
                />
                <Field
                  label="Observed date"
                  value={submission.reportedAt}
                  onChange={(value) =>
                    setSubmission((state) => ({ ...state, reportedAt: value }))
                  }
                  type="date"
                />
              </div>

              <Field
                label="Headline"
                value={submission.title}
                onChange={(value) =>
                  setSubmission((state) => ({ ...state, title: value }))
                }
                placeholder="Example: Mid-sized support team reduced after chatbot rollout"
                required
              />

              <TextArea
                label="What happened?"
                value={submission.summary}
                onChange={(value) =>
                  setSubmission((state) => ({ ...state, summary: value }))
                }
                required
              />

              <Field
                label="Public source URL (optional)"
                value={submission.sourceUrl}
                onChange={(value) =>
                  setSubmission((state) => ({ ...state, sourceUrl: value }))
                }
                type="url"
                placeholder="https://"
              />

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit signal"}
              </button>

              {submissionStatus && (
                <p className="text-xs text-slate-200">{submissionStatus}</p>
              )}
            </form>
          </Panel>

          <Panel
            title="Company response channel"
            subtitle="Organizations can submit clarifications for moderation and context."
          >
            <form className="grid gap-3" onSubmit={handleSubmitCompanyResponse}>
              <Field
                label="Company"
                value={companyResponse.company}
                onChange={(value) =>
                  setCompanyResponse((state) => ({ ...state, company: value }))
                }
                required
              />

              <TextArea
                label="Official statement"
                value={companyResponse.statement}
                onChange={(value) =>
                  setCompanyResponse((state) => ({ ...state, statement: value }))
                }
                required
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Contact email (optional)"
                  value={companyResponse.contactEmail}
                  onChange={(value) =>
                    setCompanyResponse((state) => ({ ...state, contactEmail: value }))
                  }
                  type="email"
                />
                <Field
                  label="Reference URL (optional)"
                  value={companyResponse.referenceUrl}
                  onChange={(value) =>
                    setCompanyResponse((state) => ({ ...state, referenceUrl: value }))
                  }
                  type="url"
                  placeholder="https://"
                />
              </div>

              <button
                type="submit"
                disabled={submittingResponse}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingResponse ? "Submitting..." : "Submit company response"}
              </button>

              {companyStatus && <p className="text-xs text-slate-200">{companyStatus}</p>}
            </form>
          </Panel>
        </section>

        <footer className="mt-6 rounded-2xl border border-slate-200/10 bg-slate-900/60 p-4 text-xs text-slate-300 md:p-5">
          <p>
            Legal note: this dashboard aggregates self-reported and public signals for
            statistical analysis. It does not assert wrongdoing or legal liability by
            any company.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur-xl md:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-slate-300">{subtitle}</p>
      </div>
      {children}
    </article>
  );
}

function StatTile({
  icon,
  label,
  value,
  note,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-amber-300/40 bg-amber-200/10"
          : "border-slate-200/10 bg-slate-950/50"
      }`}
    >
      <div className="mb-2 inline-flex rounded-lg bg-slate-900/80 p-1.5">{icon}</div>
      <p className="text-xs text-slate-300">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-[11px] text-slate-300">{note}</p>
    </div>
  );
}

function Tag({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1">
      {icon}
      {text}
    </span>
  );
}

function NumberBoardTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/10 bg-slate-900/65 p-4 shadow-xl backdrop-blur-xl">
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{note}</p>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  as = "input",
  options,
  fallbackOptions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  as?: "input" | "select";
  options?: string[];
  fallbackOptions?: string[];
}) {
  const effectiveOptions =
    options && options.length > 0
      ? options
      : fallbackOptions && fallbackOptions.length > 0
        ? fallbackOptions
        : [];

  return (
    <label className="grid gap-1 text-xs text-slate-300">
      {label}
      {as === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          className="rounded-xl border border-slate-600/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
        >
          {effectiveOptions.map((option) => (
            <option key={option} value={option} className="bg-slate-950">
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          type={type}
          className="rounded-xl border border-slate-600/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
        />
      )}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-300">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={4}
        className="rounded-xl border border-slate-600/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300"
      />
    </label>
  );
}
