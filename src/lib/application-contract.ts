import { candidate03PackageChoices } from "@/lib/offer-domain/adapters/candidate03";
import type { TariffId } from "@/lib/offer-domain/identifiers";
import { resolveOfferDomainConsumer } from "@/lib/offer-domain/rollout";

export const applicationStatuses = [
  "new",
  "contacted",
  "lesson_booked",
  "closed",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  new: "Новая",
  contacted: "Связались",
  lesson_booked: "Урок согласован",
  closed: "Закрыта",
};

export const englishLevelOptions = [
  { value: "beginner", label: "Начинающий · A0–A1" },
  { value: "elementary", label: "Базовый · A1–A2" },
  { value: "intermediate", label: "Средний · B1–B2" },
  { value: "unsure", label: "Не уверены — определить вместе" },
] as const;

export type EnglishLevel = (typeof englishLevelOptions)[number]["value"];

export const englishLevelLabels = Object.fromEntries(
  englishLevelOptions.map((option) => [option.value, option.label]),
) as Record<EnglishLevel, string>;

export const contactMethodOptions = [
  { value: "telegram", label: "Telegram" },
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Email" },
] as const;

export type ContactMethod = (typeof contactMethodOptions)[number]["value"];

export const contactMethodLabels = Object.fromEntries(
  contactMethodOptions.map((option) => [option.value, option.label]),
) as Record<ContactMethod, string>;

export type LessonFormat = "online" | "in-person";

export type PublicApplicationPayload = {
  turnstileToken: string;
  idempotencyKey: string;
  website: string;
  parentName: string;
  learnerName: string;
  learnerAgeOrGrade: string;
  englishLevel: EnglishLevel;
  goals: string;
  tariffId: TariffId;
  packageLessons: 1 | 4 | 8;
  lessonFormat: LessonFormat;
  preferredSchedule: string;
  contactMethod: ContactMethod;
  contactValue: string;
  notes: string;
  policyAcknowledged: boolean;
  privacyAcknowledged: boolean;
};

export type PublicApplicationSuccess = {
  ok: true;
  reference: string;
  createdAt: string;
  duplicate: boolean;
};

export type PublicApplicationFailure = {
  ok: false;
  type: "validation" | "rate-limit" | "server";
  message: string;
  errors?: Partial<Record<keyof PublicApplicationPayload, string>>;
};

export type AdminApplicationRecord = {
  id: string;
  publicReference: string;
  createdAt: number;
  updatedAt: number;
  status: ApplicationStatus;
  parentName: string;
  learnerName: string;
  learnerAgeOrGrade: string;
  englishLevel: EnglishLevel;
  goals: string;
  tariffId: TariffId;
  packageLessons: 1 | 4 | 8;
  lessonFormat: LessonFormat;
  preferredSchedule: string;
  contactMethod: ContactMethod;
  contactValue: string;
  notes: string;
  policyAcknowledged: boolean;
  privacyAcknowledged: boolean;
};

export const applicationLimits = {
  parentName: 80,
  learnerName: 80,
  learnerAgeOrGrade: 40,
  goals: 1000,
  preferredSchedule: 300,
  contactValue: 160,
  notes: 1000,
  payloadBytes: 16_384,
  rateLimitAttempts: 5,
  rateLimitWindowMs: 15 * 60 * 1000,
} as const;

export const legacyPackagesByTariff: Record<TariffId, readonly (1 | 4 | 8)[]> = {
  basic: [1, 4, 8],
  standard: [1, 4, 8],
  premium: [4, 8],
};

export const packagesByTariff: Record<TariffId, readonly (1 | 4 | 8)[]> =
  resolveOfferDomainConsumer("candidate03-selection")
    ? {
        basic: candidate03PackageChoices("basic"),
        standard: candidate03PackageChoices("standard"),
        premium: candidate03PackageChoices("premium"),
      }
    : legacyPackagesByTariff;
