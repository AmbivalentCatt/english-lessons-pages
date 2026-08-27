import { addCalendarDays, addCalendarWeeks } from "../effective-window";
import type { PackageOffer } from "../types";

export const PACKAGE_VALIDITY_POLICY = Object.freeze({
  fourLessonCalendarWeeks: 5,
  eightLessonCalendarWeeks: 10,
  premiumForceMajeureExtension: "manual-approval" as const,
  studentTransfersExtendAutomatically: false,
  unusedLessonsAfterExpiry: "deducted" as const,
  expiryExceptions: Object.freeze([
    "teacher-cancellation",
    "preapproved-premium-force-majeure-extension",
  ] as const),
  retroactiveApplicationAllowed: false,
});

export function packageExpiresAt(firstLessonAt: string, packageOffer: PackageOffer): string | null {
  return packageOffer.validityCalendarWeeks === null
    ? null
    : addCalendarWeeks(firstLessonAt, packageOffer.validityCalendarWeeks);
}

export function isPackageActive(at: string, expiresAt: string | null): boolean {
  if (expiresAt === null) return true;
  return Date.parse(at) < Date.parse(expiresAt);
}

export function scheduleHoldExpiresAt(proposedAt: string): string {
  return addCalendarDays(proposedAt, 1);
}

export function isScheduleHoldActive(at: string, expiresAt: string): boolean {
  return Date.parse(at) < Date.parse(expiresAt);
}

export function refundRequestDeadline(confirmedAt: string): string {
  return addCalendarDays(confirmedAt, 14);
}

export function isRefundRequestTimely(requestedAt: string, deadline: string): boolean {
  return Date.parse(requestedAt) <= Date.parse(deadline);
}

export type RefundDecisionInput = Readonly<{
  unusedValueConfirmed: boolean;
  requestedAt: string;
  confirmationAt: string;
  completedLessonValueMinorUnits: number;
  properLateCancellationValueMinorUnits: number;
}>;

export function evaluateRefund(input: RefundDecisionInput): Readonly<{
  eligible: boolean;
  reason: "eligible-unused-value" | "not-confirmed-unused" | "outside-fourteen-days";
  excludedMinorUnits: number;
  remedies: readonly "refund"[];
}> {
  const excludedMinorUnits = input.completedLessonValueMinorUnits
    + input.properLateCancellationValueMinorUnits;
  if (!input.unusedValueConfirmed) {
    return Object.freeze({ eligible: false, reason: "not-confirmed-unused", excludedMinorUnits, remedies: [] });
  }
  if (!isRefundRequestTimely(input.requestedAt, refundRequestDeadline(input.confirmationAt))) {
    return Object.freeze({ eligible: false, reason: "outside-fourteen-days", excludedMinorUnits, remedies: [] });
  }
  return Object.freeze({
    eligible: true,
    reason: "eligible-unused-value",
    excludedMinorUnits,
    remedies: Object.freeze(["refund"] as const),
  });
}
