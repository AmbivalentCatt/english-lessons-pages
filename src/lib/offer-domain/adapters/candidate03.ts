import { CURRENT_OFFER } from "../catalog/current-offer";
import type { MoscowIsoInstant } from "../effective-window";
import type { LessonFormatId, PackageLessons, TariffId } from "../identifiers";
import { packageChoices } from "../selectors/packages";
import type { OfferQuote, OfferSelection } from "../types";
import { validateOfferSelection } from "../validation/selection";

export type OfferQuoteStoragePort = Readonly<{
  writeOfferQuote(applicationReference: string, quote: OfferQuote): Promise<void>;
  readOfferQuote(applicationReference: string): Promise<OfferQuote | null>;
}>;

export type FutureApplicationOfferStorageFields = Readonly<{
  offerVersion: string;
  offerEffectiveFrom: MoscowIsoInstant;
  quotedPriceMinorUnits: number;
  quotedCurrency: "RUB";
  quotedAt: string;
}>;

export function candidate03PackageChoices(tariffId: TariffId): readonly PackageLessons[] {
  return packageChoices(tariffId);
}

export function candidate03SelectionAllowed(
  tariffId: unknown,
  packageLessons: unknown,
  lessonFormat: unknown,
): boolean {
  return validateOfferSelection({ tariffId, packageLessons, lessonFormat }).valid;
}

export function createOfferQuote(
  selection: OfferSelection,
  effectiveFrom: MoscowIsoInstant,
  quotedAt: string,
): OfferQuote {
  const validation = validateOfferSelection(selection);
  if (!validation.valid) throw new RangeError(`Invalid offer selection: ${validation.code}`);
  const packageOffer = CURRENT_OFFER.tariffs[selection.tariffId].packages[selection.packageLessons];
  if (!packageOffer) throw new RangeError("Selected package is unavailable.");
  return Object.freeze({
    offerVersion: CURRENT_OFFER.offerVersion,
    effectiveFrom,
    selection: Object.freeze({ ...selection }),
    quotedPrice: packageOffer.total,
    quotedAt,
  });
}

export function toFutureApplicationOfferStorageFields(quote: OfferQuote): FutureApplicationOfferStorageFields {
  return Object.freeze({
    offerVersion: quote.offerVersion,
    offerEffectiveFrom: quote.effectiveFrom,
    quotedPriceMinorUnits: quote.quotedPrice.minorUnits,
    quotedCurrency: quote.quotedPrice.currency,
    quotedAt: quote.quotedAt,
  });
}

export type Candidate03Selection = Readonly<{
  tariffId: TariffId;
  packageLessons: PackageLessons;
  lessonFormat: LessonFormatId;
}>;
