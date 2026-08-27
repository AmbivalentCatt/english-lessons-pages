import type { TariffId } from "../identifiers";
import type { TransferAllowance } from "../types";
import { CURRENT_OFFER } from "../catalog/current-offer";
import { hasNormalTransferNotice } from "./scheduling";

export type TransferHistoryEntry = Readonly<{
  lessonId: string;
  disposition: "normal-transfer" | "emergency-transfer" | "late-cancellation" | "teacher-cancellation";
}>;

export type TransferRequest = Readonly<{
  tariffId: TariffId;
  packageLessons: 1 | 4 | 8;
  lessonId: string;
  requestedAt: string;
  lessonAt: string;
  kind: "normal" | "emergency" | "late-cancellation" | "teacher-cancellation";
  emergencyManuallyApproved?: boolean;
  history: readonly TransferHistoryEntry[];
}>;

function consumed(history: readonly TransferHistoryEntry[], kind: "normal" | "emergency"): number {
  const disposition = kind === "normal" ? "normal-transfer" : "emergency-transfer";
  return history.filter((entry) => entry.disposition === disposition).length;
}

export function evaluateTransfer(request: TransferRequest): Readonly<{
  accepted: boolean;
  disposition: TransferHistoryEntry["disposition"] | "rejected";
  consumesAllowance: boolean;
  chargedOrDeducted: boolean;
  recordedAsConducted: false;
  reason: string;
}> {
  if (request.kind === "teacher-cancellation") {
    return Object.freeze({ accepted: true, disposition: "teacher-cancellation", consumesAllowance: false, chargedOrDeducted: false, recordedAsConducted: false, reason: "teacher-move-or-credit" });
  }
  if (request.kind === "late-cancellation") {
    return Object.freeze({ accepted: true, disposition: "late-cancellation", consumesAllowance: false, chargedOrDeducted: true, recordedAsConducted: false, reason: "late-cancellation-recorded-separately" });
  }
  if (request.history.some((entry) => entry.lessonId === request.lessonId && (entry.disposition === "normal-transfer" || entry.disposition === "emergency-transfer"))) {
    return Object.freeze({ accepted: false, disposition: "rejected", consumesAllowance: false, chargedOrDeducted: false, recordedAsConducted: false, reason: "same-lesson-cannot-be-moved-repeatedly" });
  }
  const allowance: TransferAllowance = CURRENT_OFFER.tariffs[request.tariffId].transferAllowances[request.packageLessons];
  if (request.kind === "normal") {
    if (!hasNormalTransferNotice(request.requestedAt, request.lessonAt)) {
      return Object.freeze({ accepted: false, disposition: "rejected", consumesAllowance: false, chargedOrDeducted: true, recordedAsConducted: false, reason: "less-than-24-hours-notice" });
    }
    if (consumed(request.history, "normal") >= allowance.normal) {
      return Object.freeze({ accepted: false, disposition: "rejected", consumesAllowance: false, chargedOrDeducted: true, recordedAsConducted: false, reason: "normal-allowance-exhausted" });
    }
    return Object.freeze({ accepted: true, disposition: "normal-transfer", consumesAllowance: true, chargedOrDeducted: false, recordedAsConducted: false, reason: "normal-transfer-approved" });
  }
  if (!request.emergencyManuallyApproved || allowance.emergencyApproval === "not-available") {
    return Object.freeze({ accepted: false, disposition: "rejected", consumesAllowance: false, chargedOrDeducted: true, recordedAsConducted: false, reason: "emergency-requires-manual-force-majeure-approval" });
  }
  if (allowance.emergency !== "manual-discretion" && consumed(request.history, "emergency") >= allowance.emergency) {
    return Object.freeze({ accepted: false, disposition: "rejected", consumesAllowance: false, chargedOrDeducted: true, recordedAsConducted: false, reason: "emergency-allowance-exhausted" });
  }
  return Object.freeze({ accepted: true, disposition: "emergency-transfer", consumesAllowance: true, chargedOrDeducted: false, recordedAsConducted: false, reason: "emergency-force-majeure-approved" });
}
