export const OFFER_TIME_ZONE = "Europe/Moscow" as const;
export type MoscowIsoInstant = `${number}-${number}-${number}T${string}+03:00`;

export type EffectiveFrom =
  | Readonly<{ status: "resolved"; at: MoscowIsoInstant; timeZone: typeof OFFER_TIME_ZONE }>
  | Readonly<{
      status: "pending-publication";
      timeZone: typeof OFFER_TIME_ZONE;
      resolution: "set-to-authoritative-deployment-effective-instant";
    }>;

export function resolvedEffectiveFrom(at: MoscowIsoInstant): EffectiveFrom {
  assertMoscowInstant(at);
  return Object.freeze({ status: "resolved", at, timeZone: OFFER_TIME_ZONE });
}

export function pendingPublicationEffectiveFrom(): EffectiveFrom {
  return Object.freeze({
    status: "pending-publication",
    timeZone: OFFER_TIME_ZONE,
    resolution: "set-to-authoritative-deployment-effective-instant",
  });
}

export function assertMoscowInstant(value: string): asserts value is MoscowIsoInstant {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+03:00$/u.test(value)) {
    throw new TypeError("Effective instant must be an explicit Europe/Moscow +03:00 timestamp.");
  }
  if (!Number.isFinite(Date.parse(value))) throw new TypeError("Effective instant is invalid.");
}

export function isPaidUnderOffer(paidAt: string, effectiveFrom: EffectiveFrom): boolean {
  if (effectiveFrom.status !== "resolved") return false;
  const paidAtMs = Date.parse(paidAt);
  if (!Number.isFinite(paidAtMs)) throw new TypeError("Payment timestamp is invalid.");
  return paidAtMs >= Date.parse(effectiveFrom.at);
}

export function addCalendarDays(instant: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new TypeError("Calendar-day offset must be an integer.");
  const milliseconds = Date.parse(instant);
  if (!Number.isFinite(milliseconds)) throw new TypeError("Timestamp is invalid.");
  return new Date(milliseconds + days * 24 * 60 * 60 * 1000).toISOString();
}

export function addCalendarWeeks(instant: string, weeks: number): string {
  return addCalendarDays(instant, weeks * 7);
}
