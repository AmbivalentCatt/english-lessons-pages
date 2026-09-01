import { resolvedEffectiveFrom } from "../effective-window";
import type { TariffId } from "../identifiers";
import { rubles } from "../money";
import { OFFER_PROVENANCE } from "../provenance";
import type { AvailabilitySnapshot, OfferCatalog, TariffOffer, TransferAllowance } from "../types";

const FORMAT_SET = ["online", "in-person"] as const;

function transfer(
  normal: number,
  emergency: number | "manual-discretion" = 0,
): TransferAllowance {
  return Object.freeze({
    normal,
    emergency,
    normalNoticeHours: 24,
    emergencyApproval:
      emergency === 0 ? "not-available" : "manual-genuine-force-majeure",
    carriesOver: false,
    repeatedMoveOfSameLessonAllowed: false,
  });
}

const BASIC: TariffOffer = Object.freeze({
  id: "basic",
  legacyName: "Basic",
  publicLabel: "BASIC",
  duration: Object.freeze({ minimumMinutes: 45, maximumMinutes: 50 }),
  audiences: Object.freeze(["school-student"] as const),
  formats: FORMAT_SET,
  packages: Object.freeze({
    1: Object.freeze({ lessons: 1, total: rubles(1_300), comparator: null, validityCalendarWeeks: null }),
    4: Object.freeze({
      lessons: 4,
      total: rubles(4_600),
      comparator: Object.freeze({ kind: "same-number-of-singles", baselineLessons: 4 }),
      validityCalendarWeeks: 5,
    }),
    8: Object.freeze({
      lessons: 8,
      total: rubles(8_740),
      comparator: Object.freeze({ kind: "same-number-of-singles", baselineLessons: 8 }),
      validityCalendarWeeks: 10,
    }),
  }),
  transferAllowances: Object.freeze({ 1: transfer(0), 4: transfer(0), 8: transfer(0) }),
  benefits: Object.freeze([
    "school-program-and-homework-support",
    "compact-lesson-format",
    "free-introductory-fit-call",
  ]),
  restrictions: Object.freeze(["school-students-only", "no-student-initiated-transfer-allowance"]),
  tools: Object.freeze([
    Object.freeze({ id: "chatgpt-high", publicName: "ChatGPT · High / Extra High", usage: "lesson-support", regularExpected: false, conditional: true }),
    Object.freeze({ id: "quizlet", publicName: "Quizlet", usage: "vocabulary-practice-on-request", regularExpected: false, conditional: true }),
  ]),
});

const STANDARD: TariffOffer = Object.freeze({
  id: "standard",
  legacyName: "Standard",
  publicLabel: "STANDARD",
  duration: Object.freeze({ minimumMinutes: 50, maximumMinutes: 55 }),
  audiences: Object.freeze(["school-student", "university-student"] as const),
  formats: FORMAT_SET,
  packages: Object.freeze({
    1: Object.freeze({ lessons: 1, total: rubles(1_450), comparator: null, validityCalendarWeeks: null }),
    4: Object.freeze({
      lessons: 4,
      total: rubles(5_200),
      comparator: Object.freeze({ kind: "same-number-of-singles", baselineLessons: 4 }),
      validityCalendarWeeks: 5,
    }),
    8: Object.freeze({
      lessons: 8,
      total: rubles(9_880),
      comparator: Object.freeze({ kind: "same-number-of-singles", baselineLessons: 8 }),
      validityCalendarWeeks: 10,
    }),
  }),
  transferAllowances: Object.freeze({ 1: transfer(1), 4: transfer(1), 8: transfer(2) }),
  benefits: Object.freeze([
    "systematic-general-english",
    "progress-report-every-four-lessons",
    "free-introductory-fit-call",
  ]),
  restrictions: Object.freeze(["no-continuous-between-lesson-study-support"]),
  tools: Object.freeze([
    Object.freeze({ id: "quizlet", publicName: "Quizlet", usage: "vocabulary-practice", regularExpected: true, conditional: false }),
    Object.freeze({ id: "chatgpt-live", publicName: "ChatGPT Live", usage: "regular-speaking-and-practice", regularExpected: true, conditional: true }),
    Object.freeze({ id: "codex", publicName: "Codex", usage: "teacher-prepared-learning-materials", regularExpected: false, conditional: true }),
    Object.freeze({ id: "gemini-pro", publicName: "Gemini Pro", usage: "teacher-prepared-learning-materials", regularExpected: false, conditional: true }),
    Object.freeze({ id: "notebooklm", publicName: "NotebookLM", usage: "source-grounded-teacher-preparation", regularExpected: false, conditional: true }),
    Object.freeze({ id: "claude", publicName: "Claude", usage: "teacher-prepared-learning-materials", regularExpected: false, conditional: true }),
  ]),
});

const PREMIUM: TariffOffer = Object.freeze({
  id: "premium",
  legacyName: "Premium",
  publicLabel: "PRO",
  duration: Object.freeze({ minimumMinutes: 60, maximumMinutes: 60 }),
  audiences: Object.freeze(["school-student", "university-student", "adult"] as const),
  formats: FORMAT_SET,
  packages: Object.freeze({
    4: Object.freeze({ lessons: 4, total: rubles(6_000), comparator: null, validityCalendarWeeks: 5 }),
    8: Object.freeze({
      lessons: 8,
      total: rubles(11_400),
      comparator: Object.freeze({ kind: "two-four-lesson-packages", baselineLessons: 8 }),
      validityCalendarWeeks: 10,
    }),
  }),
  transferAllowances: Object.freeze({
    1: transfer(1, "manual-discretion"),
    4: transfer(1, 1),
    8: transfer(2, 1),
  }),
  benefits: Object.freeze([
    "telegram-study-questions",
    "personalized-report-after-each-lesson",
    "dashboard-after-four-completed-lessons-on-prepaid-eight-pack",
    "free-introductory-fit-call",
  ]),
  restrictions: Object.freeze([
    "packages-only",
    "oge-ege-requires-at-least-two-lessons-weekly",
    "priority-only-among-actually-available-recurring-times",
    "no-peak-slot-guarantee",
  ]),
  tools: STANDARD.tools,
});

export const CURRENT_OFFER: OfferCatalog = Object.freeze({
  schemaVersion: 1,
  offerVersion: "candidate04-v24",
  authority: "candidate04-production-approved",
  effectiveFrom: resolvedEffectiveFrom("2026-08-26T04:50:21+03:00"),
  tariffs: Object.freeze({ basic: BASIC, standard: STANDARD, premium: PREMIUM }),
  shared: Object.freeze({
    proposedScheduleHoldHours: 24,
    fullPrepaymentRequired: true,
    applicationsReserveCapacity: false,
    availabilityFreshnessDays: 7,
    nonRenewalReleaseDays: 7,
    refundCalendarDaysAfterConfirmation: 14,
    introCallMaximumMinutes: 10,
    introCallFree: true,
    introCallIsLessonOrDiagnostic: false,
  }),
  provenance: Object.freeze([OFFER_PROVENANCE.version21, OFFER_PROVENANCE.selectedB]),
});

export const CURRENT_AVAILABILITY_SNAPSHOT: AvailabilitySnapshot = Object.freeze({
  snapshotId: "availability-20260901-standard-slot-confirmed-1-of-7",
  unit: "remaining-active-student-places",
  source: "manual-user-approved-ledger",
  verifiedAt: "2026-09-01T08:49:05+03:00",
  freshnessDays: 7,
  capacities: Object.freeze({ basic: 5, standard: 7, premium: 4 }),
  remaining: Object.freeze({ basic: 3, standard: 1, premium: 2 }),
});

export const CURRENT_CAPACITY_TOTAL = Object.values(CURRENT_AVAILABILITY_SNAPSHOT.capacities)
  .reduce((sum, capacity) => sum + capacity, 0);

export function currentTariff(tariffId: TariffId): TariffOffer {
  return CURRENT_OFFER.tariffs[tariffId];
}
