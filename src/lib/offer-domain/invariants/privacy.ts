import type { AvailabilitySnapshot } from "../types";
import { canonicalJson } from "../serialization/canonical-json";
import { serializePublicOffer } from "../serialization/public-offer";

const FORBIDDEN_PUBLIC_FRAGMENTS = [
  "approximateInternalPlanningMinutesPerWeek",
  "minimumCompletedLessons",
  "discountMinorUnits",
  "syntheticRecordId",
  "parentName",
  "learnerName",
  "contactValue",
  "formToken",
  "idempotencyKey",
  "applicant",
  "rawHistory",
  "forecast",
] as const;

export function assertPublicSerializationPrivacy(snapshot: AvailabilitySnapshot, now: string): true {
  const serialized = canonicalJson(serializePublicOffer(snapshot, now));
  for (const fragment of FORBIDDEN_PUBLIC_FRAGMENTS) {
    if (serialized.includes(fragment)) throw new Error(`Public offer leaks forbidden fragment: ${fragment}`);
  }
  return true;
}
