export type HolidayCalendarPort = Readonly<{
  isRussianFederalHoliday(date: string): boolean;
  isUnitedStatesFederalHoliday(date: string): boolean;
}>;

function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new TypeError("Date must use YYYY-MM-DD.");
  return value;
}

function addDateDays(date: string, days: number): string {
  const parsed = new Date(`${dateOnly(date)}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function isSupportBusinessDay(date: string, holidays: HolidayCalendarPort): boolean {
  const day = new Date(`${dateOnly(date)}T12:00:00Z`).getUTCDay();
  return day >= 1
    && day <= 5
    && !holidays.isRussianFederalHoliday(date)
    && !holidays.isUnitedStatesFederalHoliday(date);
}

export function nextSupportBusinessDay(date: string, holidays: HolidayCalendarPort): string {
  let candidate = addDateDays(date, 1);
  while (!isSupportBusinessDay(candidate, holidays)) candidate = addDateDays(candidate, 1);
  return candidate;
}

export function supportResponseWindow(
  receivedMoscowDate: string,
  holidays: HolidayCalendarPort,
): Readonly<{ queueStartsOn: string; respondByEndOf: string }> {
  const queueStartsOn = isSupportBusinessDay(receivedMoscowDate, holidays)
    ? dateOnly(receivedMoscowDate)
    : nextSupportBusinessDay(receivedMoscowDate, holidays);
  return Object.freeze({
    queueStartsOn,
    respondByEndOf: nextSupportBusinessDay(queueStartsOn, holidays),
  });
}

export const PUBLIC_PRO_SUPPORT_POLICY = Object.freeze({
  channel: "Telegram",
  responseWithinBusinessDays: 1,
  weekdays: Object.freeze(["monday", "tuesday", "wednesday", "thursday", "friday"]),
  excludesRussianFederalHolidays: true,
  excludesUnitedStatesFederalHolidays: true,
  timeZone: "Europe/Moscow",
  asynchronous: true,
  continuousLiveSupport: false,
});

export const PRIVATE_PRO_SUPPORT_POLICY = Object.freeze({
  approximateInternalPlanningMinutesPerWeek: 15,
  publicSafe: false,
});
