export const TARIFF_IDS = ["basic", "standard", "premium"] as const;
export type TariffId = (typeof TARIFF_IDS)[number];

export const PUBLIC_TARIFF_LABELS = {
  basic: "BASIC",
  standard: "STANDARD",
  premium: "PRO",
} as const satisfies Record<TariffId, string>;

export const LEGACY_TARIFF_NAMES = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
} as const satisfies Record<TariffId, string>;

export const PACKAGE_LESSON_COUNTS = [1, 4, 8] as const;
export type PackageLessons = (typeof PACKAGE_LESSON_COUNTS)[number];

export const LESSON_FORMAT_IDS = ["online", "in-person"] as const;
export type LessonFormatId = (typeof LESSON_FORMAT_IDS)[number];

export const AUDIENCE_IDS = [
  "school-student",
  "university-student",
  "adult",
] as const;
export type AudienceId = (typeof AUDIENCE_IDS)[number];

export function isTariffId(value: unknown): value is TariffId {
  return typeof value === "string" && TARIFF_IDS.includes(value as TariffId);
}

export function isPackageLessons(value: unknown): value is PackageLessons {
  return typeof value === "number" && PACKAGE_LESSON_COUNTS.includes(value as PackageLessons);
}

export function isLessonFormatId(value: unknown): value is LessonFormatId {
  return typeof value === "string" && LESSON_FORMAT_IDS.includes(value as LessonFormatId);
}
