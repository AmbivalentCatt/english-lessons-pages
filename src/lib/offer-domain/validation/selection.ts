import { CURRENT_OFFER } from "../catalog/current-offer";
import { isLessonFormatId, isPackageLessons, isTariffId } from "../identifiers";
import type { OfferSelection } from "../types";

export type SelectionValidation = Readonly<{
  valid: boolean;
  code: "valid" | "invalid-tariff" | "invalid-package" | "invalid-format";
  selection?: OfferSelection;
}>;

export function validateOfferSelection(input: Readonly<{
  tariffId: unknown;
  packageLessons: unknown;
  lessonFormat: unknown;
}>): SelectionValidation {
  if (!isTariffId(input.tariffId)) return Object.freeze({ valid: false, code: "invalid-tariff" });
  if (!isPackageLessons(input.packageLessons) || !CURRENT_OFFER.tariffs[input.tariffId].packages[input.packageLessons]) {
    return Object.freeze({ valid: false, code: "invalid-package" });
  }
  if (!isLessonFormatId(input.lessonFormat) || !CURRENT_OFFER.tariffs[input.tariffId].formats.includes(input.lessonFormat)) {
    return Object.freeze({ valid: false, code: "invalid-format" });
  }
  return Object.freeze({
    valid: true,
    code: "valid",
    selection: Object.freeze({ tariffId: input.tariffId, packageLessons: input.packageLessons, lessonFormat: input.lessonFormat }),
  });
}
