export const SCHEDULING_POLICY = Object.freeze({
  normalTransferNoticeHours: 24,
  proposedRecurringScheduleHoldHours: 24,
  releaseWithoutPaymentAfterHold: true,
  manualHoldExtensionAllowed: true,
  fullPrepaymentRequired: true,
  fullPaymentConfirmsPurchase: true,
  enrollmentConfirmationIsManual: true,
  applicationIsEnrollmentPaymentOrReservation: false,
  alternativesDependOnActualSchedule: true,
  permanentChangesRequireSeparateAgreement: true,
  teacherCancellationConsumesStudentAllowance: false,
  teacherCancellationRemedy: "move-or-credit" as const,
});

export function hasNormalTransferNotice(requestedAt: string, lessonAt: string): boolean {
  const leadTime = Date.parse(lessonAt) - Date.parse(requestedAt);
  if (!Number.isFinite(leadTime)) throw new TypeError("Transfer timestamps must be valid.");
  return leadTime >= 24 * 60 * 60 * 1000;
}
