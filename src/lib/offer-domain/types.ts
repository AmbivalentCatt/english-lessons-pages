import type { EffectiveFrom, MoscowIsoInstant } from "./effective-window";
import type {
  AudienceId,
  LessonFormatId,
  PackageLessons,
  TariffId,
} from "./identifiers";
import type { Money } from "./money";
import type { OfferProvenance } from "./provenance";

export type DurationRange = Readonly<{ minimumMinutes: number; maximumMinutes: number }>;

export type DiscountComparator =
  | Readonly<{ kind: "same-number-of-singles"; baselineLessons: PackageLessons }>
  | Readonly<{ kind: "two-four-lesson-packages"; baselineLessons: 8 }>;

export type PackageOffer = Readonly<{
  lessons: PackageLessons;
  total: Money;
  comparator: DiscountComparator | null;
  validityCalendarWeeks: 5 | 10 | null;
}>;

export type TransferAllowance = Readonly<{
  normal: number;
  emergency: number | "manual-discretion";
  normalNoticeHours: 24;
  emergencyApproval: "not-available" | "manual-genuine-force-majeure";
  carriesOver: false;
  repeatedMoveOfSameLessonAllowed: false;
}>;

export type ToolBenefit = Readonly<{
  id: string;
  publicName: string;
  usage: string;
  regularExpected: boolean;
  conditional: boolean;
}>;

export type TariffOffer = Readonly<{
  id: TariffId;
  legacyName: "Basic" | "Standard" | "Premium";
  publicLabel: "BASIC" | "STANDARD" | "PRO";
  duration: DurationRange;
  audiences: readonly AudienceId[];
  formats: readonly LessonFormatId[];
  packages: Readonly<Partial<Record<PackageLessons, PackageOffer>>>;
  transferAllowances: Readonly<Record<PackageLessons, TransferAllowance>>;
  benefits: readonly string[];
  restrictions: readonly string[];
  tools: readonly ToolBenefit[];
}>;

export type AvailabilitySnapshot = Readonly<{
  snapshotId: string;
  unit: "remaining-active-student-places";
  source: "manual-user-approved-ledger" | "deterministic-test" | "future-production-port";
  verifiedAt: MoscowIsoInstant;
  freshnessDays: 7;
  capacities: Readonly<Record<TariffId, number>>;
  remaining: Readonly<Record<TariffId, number>>;
}>;

export type OfferSelection = Readonly<{
  tariffId: TariffId;
  packageLessons: PackageLessons;
  lessonFormat: LessonFormatId;
}>;

export type OfferCatalog = Readonly<{
  schemaVersion: 1;
  offerVersion: string;
  authority: "local-candidate04-pending-publication" | "candidate04-production-approved" | "historical";
  effectiveFrom: EffectiveFrom;
  tariffs: Readonly<Record<TariffId, TariffOffer>>;
  shared: Readonly<{
    proposedScheduleHoldHours: 24;
    fullPrepaymentRequired: true;
    applicationsReserveCapacity: false;
    availabilityFreshnessDays: 7;
    nonRenewalReleaseDays: 7;
    refundCalendarDaysAfterConfirmation: 14;
    introCallMaximumMinutes: 10;
    introCallFree: true;
    introCallIsLessonOrDiagnostic: false;
  }>;
  provenance: readonly OfferProvenance[];
}>;

export type OfferQuote = Readonly<{
  offerVersion: string;
  effectiveFrom: MoscowIsoInstant;
  selection: OfferSelection;
  quotedPrice: Money;
  quotedAt: string;
}>;

export type OfferSnapshot = Readonly<{
  offerVersion: string;
  effectiveFrom: MoscowIsoInstant;
  catalogFingerprint: string;
  catalog: OfferCatalog;
}>;

export type PublicAvailability = Readonly<{
  status: "fresh" | "confirmation-required";
  label: string;
  verifiedAt: MoscowIsoInstant;
  remaining?: Readonly<Record<TariffId, number>>;
}>;
