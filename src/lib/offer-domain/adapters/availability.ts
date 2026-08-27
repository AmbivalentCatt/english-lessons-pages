import type { AvailabilityPort } from "../policies/availability";
import { assertAvailabilitySnapshot, canReleaseNonRenewal } from "../policies/availability";
import type { AvailabilitySnapshot } from "../types";

function copySnapshot(snapshot: AvailabilitySnapshot, remaining = snapshot.remaining): AvailabilitySnapshot {
  return Object.freeze({ ...snapshot, remaining: Object.freeze({ ...remaining }) });
}

export function createStaticAvailabilityAdapter(snapshot: AvailabilitySnapshot): AvailabilityPort {
  assertAvailabilitySnapshot(snapshot);
  return Object.freeze({
    async readSnapshot() { return copySnapshot(snapshot); },
    async confirmPaidEnrollment() { throw new Error("Static availability adapter is read-only; no production persistence is configured."); },
    async releaseEnrollment() { throw new Error("Static availability adapter is read-only; no production persistence is configured."); },
  });
}

export function createDeterministicAvailabilityAdapter(initial: AvailabilitySnapshot): AvailabilityPort {
  let current = copySnapshot(assertAvailabilitySnapshot(initial));
  return Object.freeze({
    async readSnapshot() { return copySnapshot(current); },
    async confirmPaidEnrollment(input) {
      if (!input.verifiedFullPayment) throw new Error("Full payment must be verified before manual enrollment confirmation.");
      const remaining = current.remaining[input.tariffId];
      if (remaining <= 0) throw new RangeError("No remaining capacity for this tariff.");
      current = copySnapshot(current, { ...current.remaining, [input.tariffId]: remaining - 1 });
      return copySnapshot(current);
    },
    async releaseEnrollment(input) {
      if (input.reason === "not-renewed") {
        if (!input.finalPackageLessonAt) throw new Error("Final package lesson is required for a non-renewal release.");
        if (!canReleaseNonRenewal(input.finalPackageLessonAt, input.occurredAt)) {
          throw new Error("Non-renewal release requires seven calendar days after the final package lesson.");
        }
      }
      const remaining = current.remaining[input.tariffId];
      const capacity = current.capacities[input.tariffId];
      if (remaining >= capacity) throw new RangeError("Cannot release above tariff capacity.");
      current = copySnapshot(current, { ...current.remaining, [input.tariffId]: remaining + 1 });
      return copySnapshot(current);
    },
  });
}
