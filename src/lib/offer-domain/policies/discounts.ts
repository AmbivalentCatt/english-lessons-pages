import type { PackageLessons, TariffId } from "../identifiers";
import { moneyFromMinorUnits, percentageSavingsBasisPoints, subtractMoney, type Money } from "../money";
import { CURRENT_OFFER } from "../catalog/current-offer";

export type PackageSavings = Readonly<{
  tariffId: TariffId;
  packageLessons: PackageLessons;
  comparator: "none" | "same-number-of-singles" | "two-four-lesson-packages";
  baseline: Money | null;
  savings: Money;
  savingsBasisPoints: number;
}>;

export function packageSavings(tariffId: TariffId, packageLessons: PackageLessons): PackageSavings {
  const tariff = CURRENT_OFFER.tariffs[tariffId];
  const packageOffer = tariff.packages[packageLessons];
  if (!packageOffer) throw new RangeError("Package is not offered for this tariff.");
  if (!packageOffer.comparator) {
    return Object.freeze({ tariffId, packageLessons, comparator: "none", baseline: null, savings: moneyFromMinorUnits(0), savingsBasisPoints: 0 });
  }
  let baseline: Money;
  if (packageOffer.comparator.kind === "same-number-of-singles") {
    const single = tariff.packages[1];
    if (!single) throw new Error("Same-number comparator requires a real single price.");
    baseline = moneyFromMinorUnits(single.total.minorUnits * packageOffer.comparator.baselineLessons);
  } else {
    const fourPack = tariff.packages[4];
    if (!fourPack) throw new Error("Two-four-pack comparator requires a four-lesson package.");
    baseline = moneyFromMinorUnits(fourPack.total.minorUnits * 2);
  }
  return Object.freeze({
    tariffId,
    packageLessons,
    comparator: packageOffer.comparator.kind,
    baseline,
    savings: subtractMoney(baseline, packageOffer.total),
    savingsBasisPoints: percentageSavingsBasisPoints(packageOffer.total, baseline),
  });
}

export const PRIVATE_LOYALTY_POLICY = Object.freeze({
  publicSafe: false,
  oneTime: true,
  appliesTo: Object.freeze([4, 8] as const),
  excludes: Object.freeze(["single", "mid-package"] as const),
  minimumFinalLessonPriceMinorUnits: 105_000,
  thresholds: Object.freeze([
    Object.freeze({ minimumCompletedLessons: 0, maximumCompletedLessons: 9, discountMinorUnits: 0 }),
    Object.freeze({ minimumCompletedLessons: 10, maximumCompletedLessons: 24, discountMinorUnits: 10_000 }),
    Object.freeze({ minimumCompletedLessons: 25, maximumCompletedLessons: 49, discountMinorUnits: 20_000 }),
    Object.freeze({ minimumCompletedLessons: 50, maximumCompletedLessons: null, discountMinorUnits: 30_000 }),
  ]),
});
