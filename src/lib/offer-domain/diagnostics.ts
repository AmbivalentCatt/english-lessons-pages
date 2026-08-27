export const OFFER_DIAGNOSTIC_CODES = [
  "OFFER_PRICE_MISMATCH",
  "OFFER_DURATION_MISMATCH",
  "OFFER_PACKAGE_SET_MISMATCH",
  "OFFER_FORMAT_SET_MISMATCH",
  "OFFER_CLAIM_MISMATCH",
  "OFFER_EFFECTIVE_DATE_PENDING",
  "OFFER_AVAILABILITY_STALE",
  "OFFER_PUBLIC_SERIALIZATION_LEAK",
  "OFFER_HISTORICAL_WINDOW_OVERLAP",
  "OFFER_LEGACY_PARITY_MISMATCH",
] as const;

export type OfferDiagnosticCode = (typeof OFFER_DIAGNOSTIC_CODES)[number];

export type OfferDiagnostic = Readonly<{
  code: OfferDiagnosticCode;
  severity: "info" | "warning" | "error";
  consumerId?: string;
  tariffId?: "basic" | "standard" | "premium";
  expectedFingerprint?: string;
  actualFingerprint?: string;
}>;

const forbiddenDiagnosticKeys = new Set([
  "parentName",
  "learnerName",
  "contactValue",
  "formToken",
  "token",
  "secret",
  "eligibility",
  "applicant",
  "rawBody",
]);

export function assertPrivacySafeDiagnostic(value: OfferDiagnostic): OfferDiagnostic {
  for (const key of Object.keys(value)) {
    if (forbiddenDiagnosticKeys.has(key)) {
      throw new TypeError(`Private diagnostic field is forbidden: ${key}`);
    }
  }
  if (!OFFER_DIAGNOSTIC_CODES.includes(value.code)) {
    throw new TypeError("Unknown offer diagnostic code.");
  }
  return Object.freeze({ ...value });
}
