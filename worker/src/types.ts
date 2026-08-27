import type {
  ContactMethod,
  EnglishLevel,
  LessonFormat,
} from "../../src/lib/application-contract";
import type { TariffId } from "../../src/lib/offer-domain/identifiers";

export type ApplicationStatus = "new" | "contacted" | "lesson_booked" | "closed";

export type Env = {
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  ALLOWED_ORIGIN: string;
  DB: D1Database;
  RATE_LIMIT_SALT: string;
  TURNSTILE_EXPECTED_HOSTNAME: string;
  TURNSTILE_SECRET_KEY: string;
};

export type ValidatedApplication = {
  contactMethod: ContactMethod;
  contactValue: string;
  englishLevel: EnglishLevel;
  goals: string;
  idempotencyKey: string;
  learnerAgeOrGrade: string;
  learnerName: string;
  lessonFormat: LessonFormat;
  notes: string;
  packageLessons: 1 | 4 | 8;
  parentName: string;
  policyAcknowledged: true;
  preferredSchedule: string;
  privacyAcknowledged: true;
  tariffId: TariffId;
  turnstileToken: string;
  website: "";
};

export type TurnstileVerification = {
  action?: string;
  hostname?: string;
  success: boolean;
};

export type RequestDependencies = {
  now(): Date;
  verifyAccess(request: Request, env: Env): Promise<boolean>;
  verifyTurnstile(input: {
    env: Env;
    idempotencyKey: string;
    ip: string;
    token: string;
  }): Promise<TurnstileVerification>;
};
