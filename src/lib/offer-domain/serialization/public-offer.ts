import { CURRENT_OFFER } from "../catalog/current-offer";
import { CURRENT_PUBLIC_CLAIMS } from "../catalog/current-public-claims";
import { DATED_MARKET_AND_TEACHER_COST_EVIDENCE } from "../catalog/market-evidence";
import type { AvailabilitySnapshot } from "../types";
import { serializeAvailability } from "../policies/availability";

export function serializePublicOffer(snapshot: AvailabilitySnapshot, now: string) {
  const availability = serializeAvailability(snapshot, now);
  return Object.freeze({
    schemaVersion: CURRENT_OFFER.schemaVersion,
    offerVersion: CURRENT_OFFER.offerVersion,
    effectiveFrom: CURRENT_OFFER.effectiveFrom,
    tariffs: Object.freeze(Object.fromEntries(
      Object.entries(CURRENT_OFFER.tariffs).map(([tariffId, tariff]) => [tariffId, Object.freeze({
        id: tariff.id,
        publicLabel: tariff.publicLabel,
        duration: tariff.duration,
        audiences: tariff.audiences,
        formats: tariff.formats,
        packages: Object.freeze(Object.fromEntries(
          Object.entries(tariff.packages).map(([lessons, packageOffer]) => [lessons, Object.freeze({
            lessons: packageOffer.lessons,
            totalMinorUnits: packageOffer.total.minorUnits,
            currency: packageOffer.total.currency,
            comparator: packageOffer.comparator,
            validityCalendarWeeks: packageOffer.validityCalendarWeeks,
          })]),
        )),
        transferAllowances: tariff.transferAllowances,
        benefits: tariff.benefits,
        restrictions: tariff.restrictions,
        tools: tariff.tools,
      })]),
    )),
    availability,
    shared: CURRENT_OFFER.shared,
    claims: CURRENT_PUBLIC_CLAIMS,
    support: Object.freeze({
      tariffId: "premium",
      channel: "Telegram",
      responseWithinBusinessDays: 1,
      weekdays: Object.freeze(["monday", "tuesday", "wednesday", "thursday", "friday"]),
      excludesRussianFederalHolidays: true,
      excludesUnitedStatesFederalHolidays: true,
      timeZone: "Europe/Moscow",
      asynchronous: true,
    }),
    publicEvidence: Object.freeze({
      verifiedMonth: DATED_MARKET_AND_TEACHER_COST_EVIDENCE.provenance.verifiedMonth,
      nextReviewMonth: DATED_MARKET_AND_TEACHER_COST_EVIDENCE.provenance.nextReviewMonth,
      approximateToolAcquisitionCostsRubles: DATED_MARKET_AND_TEACHER_COST_EVIDENCE.toolAcquisitionCosts,
      customerPriceAuthority: false,
    }),
  });
}
