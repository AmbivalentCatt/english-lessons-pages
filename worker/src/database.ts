import type { ApplicationStatus, Env, ValidatedApplication } from "./types";

export type StoredIdempotency = {
  public_reference: string;
  request_hash: string;
  submitted_at: string;
};

export async function findByIdempotencyHash(db: D1Database, hash: string) {
  return db.prepare(
    "SELECT public_reference, request_hash, submitted_at FROM applications WHERE idempotency_key_hash = ?1 LIMIT 1",
  ).bind(hash).first<StoredIdempotency>();
}

export async function consumeRateLimit(input: {
  db: D1Database;
  keyHash: string;
  limit: number;
  now: Date;
  windowMs: number;
}) {
  const nowMs = input.now.getTime();
  const windowStartedAt = Math.floor(nowMs / input.windowMs) * input.windowMs;
  const row = await input.db.prepare(`
    INSERT INTO application_rate_limits (key_hash, window_started_at, request_count, updated_at)
    VALUES (?1, ?2, 1, ?3)
    ON CONFLICT(key_hash, window_started_at)
    DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at
    RETURNING request_count
  `).bind(input.keyHash, windowStartedAt, input.now.toISOString()).first<{ request_count: number }>();
  const count = row?.request_count ?? input.limit + 1;
  return {
    allowed: count <= input.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + input.windowMs - nowMs) / 1000)),
  };
}

export async function insertApplication(input: {
  db: D1Database;
  idempotencyHash: string;
  now: Date;
  payload: ValidatedApplication;
  publicReference: string;
  requestHash: string;
}) {
  const timestamp = input.now.toISOString();
  return input.db.prepare(`
    INSERT INTO applications (
      public_reference, submitted_at, parent_name, learner_name, learner_age_or_grade,
      english_level, goals, tariff_id, package_lessons, lesson_format, preferred_schedule,
      contact_method, contact_value, applicant_notes, policy_acknowledged,
      privacy_acknowledged, status, status_updated_at, internal_notes,
      idempotency_key_hash, request_hash
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
      ?12, ?13, ?14, 1, 1, 'new', ?15, '', ?16, ?17
    )
  `).bind(
    input.publicReference,
    timestamp,
    input.payload.parentName,
    input.payload.learnerName,
    input.payload.learnerAgeOrGrade,
    input.payload.englishLevel,
    input.payload.goals,
    input.payload.tariffId,
    input.payload.packageLessons,
    input.payload.lessonFormat,
    input.payload.preferredSchedule,
    input.payload.contactMethod,
    input.payload.contactValue,
    input.payload.notes,
    timestamp,
    input.idempotencyHash,
    input.requestHash,
  ).run();
}

type AdminRow = {
  applicant_notes: string;
  contact_method: string;
  contact_value: string;
  english_level: string;
  goals: string;
  internal_notes: string;
  learner_age_or_grade: string;
  learner_name: string;
  lesson_format: string;
  package_lessons: number;
  parent_name: string;
  preferred_schedule: string;
  public_reference: string;
  status: ApplicationStatus;
  status_updated_at: string;
  submitted_at: string;
  tariff_id: string;
};

function mapAdminRow(row: AdminRow) {
  return {
    applicantNotes: row.applicant_notes,
    contactMethod: row.contact_method,
    contactValue: row.contact_value,
    englishLevel: row.english_level,
    goals: row.goals,
    internalNotes: row.internal_notes,
    learnerAgeOrGrade: row.learner_age_or_grade,
    learnerName: row.learner_name,
    lessonFormat: row.lesson_format,
    packageLessons: row.package_lessons,
    parentName: row.parent_name,
    preferredSchedule: row.preferred_schedule,
    publicReference: row.public_reference,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    submittedAt: row.submitted_at,
    tariffId: row.tariff_id,
  };
}

const adminSelect = `
  SELECT public_reference, submitted_at, parent_name, learner_name, learner_age_or_grade,
    english_level, goals, tariff_id, package_lessons, lesson_format, preferred_schedule,
    contact_method, contact_value, applicant_notes, status, status_updated_at, internal_notes
  FROM applications
`;

export async function listApplications(db: D1Database, limit: number) {
  const result = await db.prepare(`${adminSelect} ORDER BY submitted_at DESC LIMIT ?1`).bind(limit).all<AdminRow>();
  return result.results.map(mapAdminRow);
}

export async function updateApplication(input: {
  db: D1Database;
  internalNotes: string;
  now: Date;
  publicReference: string;
  status: ApplicationStatus;
}) {
  const timestamp = input.now.toISOString();
  const result = await input.db.prepare(`
    UPDATE applications
    SET status = ?1,
        status_updated_at = CASE WHEN status <> ?1 THEN ?2 ELSE status_updated_at END,
        internal_notes = ?3
    WHERE public_reference = ?4
  `).bind(input.status, timestamp, input.internalNotes, input.publicReference).run();
  if (result.meta.changes !== 1) return null;
  const row = await input.db.prepare(`${adminSelect} WHERE public_reference = ?1 LIMIT 1`)
    .bind(input.publicReference).first<AdminRow>();
  return row ? mapAdminRow(row) : null;
}

export function hasRequiredRuntimeSecrets(env: Env) {
  return typeof env.TURNSTILE_SECRET_KEY === "string"
    && env.TURNSTILE_SECRET_KEY.length >= 8
    && typeof env.RATE_LIMIT_SALT === "string"
    && env.RATE_LIMIT_SALT.length >= 32;
}
