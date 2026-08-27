export type Money = Readonly<{
  currency: "RUB";
  minorUnits: number;
}>;

export function rubles(amount: number): Money {
  if (!Number.isFinite(amount)) throw new TypeError("Ruble amount must be finite.");
  const minorUnits = Math.round(amount * 100);
  if (Math.abs(amount * 100 - minorUnits) > Number.EPSILON) {
    throw new TypeError("Ruble amount cannot use fractions smaller than one kopeck.");
  }
  return Object.freeze({ currency: "RUB", minorUnits });
}

export function moneyFromMinorUnits(minorUnits: number): Money {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new TypeError("Money minor units must be a safe integer.");
  }
  return Object.freeze({ currency: "RUB", minorUnits });
}

export function addMoney(...amounts: readonly Money[]): Money {
  return moneyFromMinorUnits(amounts.reduce((sum, amount) => sum + amount.minorUnits, 0));
}

export function subtractMoney(left: Money, right: Money): Money {
  return moneyFromMinorUnits(left.minorUnits - right.minorUnits);
}

export function perLesson(total: Money, lessons: number): Money {
  if (!Number.isSafeInteger(lessons) || lessons <= 0) {
    throw new TypeError("Lesson count must be a positive integer.");
  }
  if (total.minorUnits % lessons !== 0) {
    throw new TypeError("Per-lesson price must resolve to whole minor units.");
  }
  return moneyFromMinorUnits(total.minorUnits / lessons);
}

export function percentageSavingsBasisPoints(current: Money, baseline: Money): number {
  if (baseline.minorUnits <= 0 || current.minorUnits > baseline.minorUnits) return 0;
  return Math.round(((baseline.minorUnits - current.minorUnits) * 10_000) / baseline.minorUnits);
}

export function formatRubles(amount: Money): string {
  const absolute = Math.abs(amount.minorUnits);
  const whole = Math.floor(absolute / 100);
  const kopecks = absolute % 100;
  const sign = amount.minorUnits < 0 ? "−" : "";
  const grouped = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })
    .format(whole)
    .replace(/\u00a0/gu, " ");
  return `${sign}${grouped}${kopecks === 0 ? "" : `,${String(kopecks).padStart(2, "0")}`} ₽`;
}
