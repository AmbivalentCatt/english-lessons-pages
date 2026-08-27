PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_reference TEXT NOT NULL UNIQUE,
  submitted_at TEXT NOT NULL,
  parent_name TEXT NOT NULL CHECK (length(parent_name) BETWEEN 1 AND 80),
  learner_name TEXT NOT NULL CHECK (length(learner_name) BETWEEN 1 AND 80),
  learner_age_or_grade TEXT NOT NULL CHECK (length(learner_age_or_grade) BETWEEN 1 AND 40),
  english_level TEXT NOT NULL CHECK (english_level IN ('beginner', 'elementary', 'intermediate', 'unsure')),
  goals TEXT NOT NULL CHECK (length(goals) BETWEEN 10 AND 1000),
  tariff_id TEXT NOT NULL CHECK (tariff_id IN ('basic', 'standard', 'premium')),
  package_lessons INTEGER NOT NULL CHECK (package_lessons IN (1, 4, 8)),
  lesson_format TEXT NOT NULL CHECK (lesson_format IN ('online', 'in-person')),
  preferred_schedule TEXT NOT NULL CHECK (length(preferred_schedule) BETWEEN 1 AND 300),
  contact_method TEXT NOT NULL CHECK (contact_method IN ('telegram', 'phone', 'email')),
  contact_value TEXT NOT NULL CHECK (length(contact_value) BETWEEN 3 AND 160),
  applicant_notes TEXT NOT NULL DEFAULT '' CHECK (length(applicant_notes) <= 1000),
  policy_acknowledged INTEGER NOT NULL CHECK (policy_acknowledged = 1),
  privacy_acknowledged INTEGER NOT NULL CHECK (privacy_acknowledged = 1),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'lesson_booked', 'closed')),
  status_updated_at TEXT NOT NULL,
  internal_notes TEXT NOT NULL DEFAULT '' CHECK (length(internal_notes) <= 4000),
  idempotency_key_hash TEXT NOT NULL UNIQUE CHECK (length(idempotency_key_hash) = 64),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64)
);

CREATE INDEX IF NOT EXISTS applications_status_submitted_idx
  ON applications(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS applications_submitted_idx
  ON applications(submitted_at DESC);

CREATE TABLE IF NOT EXISTS application_rate_limits (
  key_hash TEXT NOT NULL CHECK (length(key_hash) = 64),
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (key_hash, window_started_at)
);

CREATE INDEX IF NOT EXISTS application_rate_limits_window_idx
  ON application_rate_limits(window_started_at);
