import { addCalendarDays } from "../effective-window";
import type { TariffId } from "../identifiers";
import type { AvailabilitySnapshot, PublicAvailability } from "../types";
import { CURRENT_PUBLIC_CLAIMS } from "../catalog/current-public-claims";

export type AvailabilityPort = Readonly<{
  readSnapshot(): Promise<AvailabilitySnapshot>;
  confirmPaidEnrollment(input: Readonly<{
    tariffId: TariffId;
    verifiedFullPayment: boolean;
    occurredAt: string;
  }>): Promise<AvailabilitySnapshot>;
  releaseEnrollment(input: Readonly<{
    tariffId: TariffId;
    reason: "student-left" | "not-renewed";
    occurredAt: string;
    finalPackageLessonAt?: string;
  }>): Promise<AvailabilitySnapshot>;
}>;

export const AVAILABILITY_POLICY = Object.freeze({
  unit: "remaining-active-student-places" as const,
  applicationReservesCapacity: false,
  consumptionOperation: "manual-enrollment-confirmation-after-verified-full-payment" as const,
  releaseOperations: Object.freeze(["student-left", "not-renewed-after-seven-calendar-days"] as const),
  updateAfterEveryConfirmationOrRelease: true,
  reviewCadenceDays: 7,
  stalePublicBehavior: "confirmation-required" as const,
});

export function availabilityFreshUntil(snapshot: AvailabilitySnapshot): string {
  return addCalendarDays(snapshot.verifiedAt, snapshot.freshnessDays);
}

export function isAvailabilityFresh(snapshot: AvailabilitySnapshot, now: string): boolean {
  return Date.parse(now) <= Date.parse(availabilityFreshUntil(snapshot));
}

export function serializeAvailability(
  snapshot: AvailabilitySnapshot,
  now: string,
): PublicAvailability {
  if (!isAvailabilityFresh(snapshot, now)) {
    return Object.freeze({
      status: "confirmation-required",
      label: CURRENT_PUBLIC_CLAIMS.staleAvailability,
      verifiedAt: snapshot.verifiedAt,
    });
  }
  return Object.freeze({
    status: "fresh",
    label: "Осталось мест",
    verifiedAt: snapshot.verifiedAt,
    remaining: snapshot.remaining,
  });
}

export function assertAvailabilitySnapshot(snapshot: AvailabilitySnapshot): AvailabilitySnapshot {
  let capacityTotal = 0;
  let remainingTotal = 0;
  for (const tariffId of ["basic", "standard", "premium"] as const) {
    const capacity = snapshot.capacities[tariffId];
    const remaining = snapshot.remaining[tariffId];
    if (!Number.isSafeInteger(capacity) || !Number.isSafeInteger(remaining)) {
      throw new TypeError("Availability values must be integers.");
    }
    if (capacity < 0 || remaining < 0 || remaining > capacity) {
      throw new RangeError("Availability must remain between zero and capacity.");
    }
    capacityTotal += capacity;
    remainingTotal += remaining;
  }
  if (capacityTotal !== 16) throw new RangeError("Approved total capacity must remain 16.");
  if (remainingTotal > capacityTotal) throw new RangeError("Remaining total exceeds capacity.");
  return snapshot;
}

export function canReleaseNonRenewal(finalPackageLessonAt: string, occurredAt: string): boolean {
  return Date.parse(occurredAt) >= Date.parse(addCalendarDays(finalPackageLessonAt, 7));
}

export function assertApplicationDoesNotReserveCapacity(): false {
  return false;
}
