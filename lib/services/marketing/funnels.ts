import { leadService } from "@/lib/services/leads";
import { registrationService } from "@/lib/services/registrations";
import { createLogger } from "@/lib/logger";
import { getRevenueProvider, getWebAnalyticsProvider } from "./registry";
import { safeDivide } from "./metrics";
import type { ConversionFunnel, DateRange, LeadFunnel, RevenueFunnel } from "./types";

const logger = createLogger({ service: "marketing" });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Lead Funnel: visitors (Google Analytics) → leads (this app's own Lead
 * collection, already real data — see lib/services/leads). Visitor count
 * degrades to null, not 0, if the web-analytics provider is unavailable
 * or fails — see types.ts's module doc on why 0 and "unavailable" are
 * never conflated.
 */
export async function getLeadFunnel(range: DateRange): Promise<LeadFunnel> {
  const leadsResult = await leadService.listLeads(
    { createdAfter: range.from, createdBefore: range.to },
    1,
    1,
  );
  const leads = leadsResult.total;

  let visitors: number | null = null;
  try {
    const webAnalytics = await getWebAnalyticsProvider().getMetrics(range);
    if (webAnalytics.dataAvailable) visitors = webAnalytics.sessions;
  } catch (error) {
    logger.warn("marketing.web_analytics_unavailable", { error: errorMessage(error) });
  }

  return {
    visitors,
    leads,
    visitorToLeadRate: visitors !== null ? safeDivide(leads, visitors) : null,
  };
}

/**
 * Conversion Funnel: leads → registrations. Both sides are real,
 * first-party data (leadService + registrationService), so this never
 * degrades — it's the one funnel with no external dependency.
 */
export async function getConversionFunnel(range: DateRange): Promise<ConversionFunnel> {
  const [leadsResult, registrationAnalytics] = await Promise.all([
    leadService.listLeads({ createdAfter: range.from, createdBefore: range.to }, 1, 1),
    registrationService.getAnalytics(),
  ]);
  const leads = leadsResult.total;
  const registrations = registrationAnalytics.totalRegistrations;

  return {
    leads,
    registrations,
    leadToRegistrationRate: safeDivide(registrations, leads),
  };
}

/**
 * Revenue Funnel: registrations → paid students. No Payments module
 * exists yet (ARCHITECTURE.md: "not started"), so paidStudents/
 * totalRevenueInr stay null until a real RevenueProvider is registered —
 * this is never faked as 0, which would misreport "no data" as "no one
 * paid."
 */
export async function getRevenueFunnel(range: DateRange): Promise<RevenueFunnel> {
  const registrationAnalytics = await registrationService.getAnalytics();
  const registrations = registrationAnalytics.totalRegistrations;

  let paidStudents: number | null = null;
  let totalRevenueInr: number | null = null;
  try {
    const revenue = await getRevenueProvider().getMetrics(range);
    if (revenue.dataAvailable) {
      paidStudents = revenue.paidStudentCount;
      totalRevenueInr = revenue.totalRevenueInr;
    }
  } catch (error) {
    logger.warn("marketing.revenue_unavailable", { error: errorMessage(error) });
  }

  return {
    registrations,
    paidStudents,
    totalRevenueInr,
    registrationToPaidRate: paidStudents !== null ? safeDivide(paidStudents, registrations) : null,
  };
}
