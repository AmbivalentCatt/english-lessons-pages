import {
  applicationLimits,
  contactMethodOptions,
  englishLevelOptions,
  packagesByTariff,
  type PublicApplicationPayload,
} from "../../src/lib/application-contract";
import { TARIFF_IDS } from "../../src/lib/offer-domain/identifiers";
import type { ValidatedApplication } from "./types";

const allowedFields = new Set<keyof PublicApplicationPayload>([
  "turnstileToken",
  "idempotencyKey",
  "website",
  "parentName",
  "learnerName",
  "learnerAgeOrGrade",
  "englishLevel",
  "goals",
  "tariffId",
  "packageLessons",
  "lessonFormat",
  "preferredSchedule",
  "contactMethod",
  "contactValue",
  "notes",
  "policyAcknowledged",
  "privacyAcknowledged",
]);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
  });
}

type FieldErrors = Partial<Record<keyof PublicApplicationPayload, string>>;

function cleanString(value: unknown, maximum: number, minimum = 1) {
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFC").trim();
  if (containsControlCharacter(cleaned) || cleaned.length < minimum || cleaned.length > maximum) return null;
  return cleaned;
}

export function validateApplicationPayload(value: unknown):
  | { ok: true; value: ValidatedApplication }
  | { ok: false; errors: FieldErrors; spam: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: {}, spam: false };
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowedFields.has(key as keyof PublicApplicationPayload))) {
    return { ok: false, errors: {}, spam: false };
  }

  if (typeof input.website !== "string" || input.website !== "") {
    return { ok: false, errors: {}, spam: true };
  }

  const errors: FieldErrors = {};
  const parentName = cleanString(input.parentName, applicationLimits.parentName);
  const learnerName = cleanString(input.learnerName, applicationLimits.learnerName);
  const learnerAgeOrGrade = cleanString(input.learnerAgeOrGrade, applicationLimits.learnerAgeOrGrade);
  const goals = cleanString(input.goals, applicationLimits.goals, 10);
  const preferredSchedule = cleanString(input.preferredSchedule, applicationLimits.preferredSchedule);
  const contactValue = cleanString(input.contactValue, applicationLimits.contactValue, 3);
  const notes = input.notes === "" ? "" : cleanString(input.notes, applicationLimits.notes, 0);
  const turnstileToken = cleanString(input.turnstileToken, 2048, 1);

  if (!parentName) errors.parentName = "Проверьте имя контактного лица.";
  if (!learnerName) errors.learnerName = "Проверьте имя или инициалы ученика.";
  if (!learnerAgeOrGrade) errors.learnerAgeOrGrade = "Проверьте класс или курс.";
  if (!goals) errors.goals = "Опишите цель занятий (не менее 10 символов).";
  if (!preferredSchedule) errors.preferredSchedule = "Укажите предпочтительные дни и время.";
  if (!contactValue) errors.contactValue = "Проверьте контакт для связи.";
  if (notes === null) errors.notes = "Комментарий слишком длинный или содержит недопустимые символы.";
  if (!turnstileToken) errors.turnstileToken = "Пройдите защитную проверку ещё раз.";
  if (typeof input.idempotencyKey !== "string" || !uuidPattern.test(input.idempotencyKey)) {
    errors.idempotencyKey = "Обновите форму и повторите отправку.";
  }

  const englishLevel = englishLevelOptions.find((option) => option.value === input.englishLevel)?.value;
  if (!englishLevel) errors.englishLevel = "Выберите уровень английского.";

  const tariffId = TARIFF_IDS.find((candidate) => candidate === input.tariffId);
  if (!tariffId) errors.tariffId = "Выберите тариф заново.";

  const packageLessons = input.packageLessons === 1 || input.packageLessons === 4 || input.packageLessons === 8
    ? input.packageLessons
    : null;
  if (!packageLessons || (tariffId && !(packagesByTariff[tariffId] as readonly number[]).includes(packageLessons))) {
    errors.packageLessons = "Выберите доступный пакет занятий.";
  }

  const lessonFormat = input.lessonFormat === "online" || input.lessonFormat === "in-person"
    ? input.lessonFormat
    : null;
  if (!lessonFormat) errors.lessonFormat = "Выберите формат занятия.";

  const contactMethod = contactMethodOptions.find((option) => option.value === input.contactMethod)?.value;
  if (!contactMethod) errors.contactMethod = "Выберите способ связи.";
  if (contactMethod === "email" && contactValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) {
    errors.contactValue = "Проверьте адрес email.";
  }

  if (input.policyAcknowledged !== true) errors.policyAcknowledged = "Нужно принять правила расписания.";
  if (input.privacyAcknowledged !== true) errors.privacyAcknowledged = "Нужно согласиться на обработку данных заявки.";

  if (Object.keys(errors).length > 0 || !parentName || !learnerName || !learnerAgeOrGrade || !englishLevel
    || !goals || !tariffId || !packageLessons || !lessonFormat || !preferredSchedule || !contactMethod
    || !contactValue || notes === null || !turnstileToken || typeof input.idempotencyKey !== "string") {
    return { ok: false, errors, spam: false };
  }

  return {
    ok: true,
    value: {
      contactMethod,
      contactValue,
      englishLevel,
      goals,
      idempotencyKey: input.idempotencyKey,
      learnerAgeOrGrade,
      learnerName,
      lessonFormat,
      notes,
      packageLessons,
      parentName,
      policyAcknowledged: true,
      preferredSchedule,
      privacyAcknowledged: true,
      tariffId,
      turnstileToken,
      website: "",
    },
  };
}
