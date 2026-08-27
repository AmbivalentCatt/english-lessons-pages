import { CURRENT_OFFER } from "../catalog/current-offer";
import { formatRubles } from "../money";

export type LegacyTariffView = Readonly<{
  id: "basic" | "standard" | "premium";
  name: "Basic" | "Standard" | "Premium";
  v7Name: "BASIC" | "STANDARD" | "PRO";
  duration: string;
  packageRule: string;
  prices: readonly Readonly<{ lessons: 1 | 4 | 8; label: string; price: string }>[];
  details: readonly string[];
  fit: string;
  reporting: string;
  support: string;
  transferPolicy: string;
  included: readonly string[];
  notes: readonly string[];
  tools: readonly string[];
  collapsedSummary: readonly [string, string];
  cta: Readonly<{ label: string; action: "book" | "details" | "call" }>;
  recommended?: boolean;
}>;

const FIT = Object.freeze({
  basic: "Для школьников и студентов, которым нужен самый гибкий выбор: одно занятие или пакет и минимум дополнительных сервисов.",
  standard: "Рекомендуемый старт для большинства школьников и студентов, которым нужен системный общий английский по школьной программе, GoGetter или другому согласованному учебнику.",
  premium: "Для школьников и студентов, которым нужны более строгая структура, повышенная вовлечённость, регулярный контроль и понятная картина прогресса.",
});

const INCLUDED = Object.freeze({
  basic: Object.freeze([
    "Работа по школьной программе",
    "Помощь с домашними заданиями",
    "Компактный формат занятия",
  ]),
  standard: Object.freeze([
    "Регулярные занятия",
    "Организационные ответы между занятиями",
    "Вопросы по материалу и домашнему заданию разбираются на занятии",
  ]),
  premium: Object.freeze([
    "Разумная помощь с короткими вопросами между занятиями",
    "Ответ в течение одного рабочего дня",
    "Приоритет при первоначальном выборе доступного постоянного времени",
  ]),
});

const REPORTING = Object.freeze({
  basic: "Без отдельного отчёта между занятиями.",
  standard: "Отчёт о сильных и слабых сторонах — раз в 4 занятия.",
  premium: "Персонализированный отчёт и трекинг после каждого занятия.",
});

const SUPPORT = Object.freeze({
  basic: "Вопросы и материал разбираются во время урока.",
  standard: "Организационные ответы между уроками; учебные вопросы разбираются на занятии.",
  premium: "Разумная помощь с короткими вопросами между занятиями; ответ в течение одного рабочего дня.",
});

const TRANSFER_POLICY = Object.freeze({
  basic: "Переносы по инициативе ученика не входят. После закрепления постоянного слота добровольный возврат не предусмотрен — кроме прав, которые нельзя ограничить по закону.",
  standard: "Один перенос на оплаченный пакет при предупреждении не менее чем за 24 часа.",
  premium: "До двух переносов на оплаченный пакет при предупреждении не менее чем за 24 часа.",
});

const NOTES = Object.freeze({
  basic: Object.freeze([
    "Доступный компактный формат",
    "Без поддержки между занятиями",
  ]),
  standard: Object.freeze([
    "Организационные ответы между занятиями",
    "Вопросы по материалу и домашнему заданию разбираются на занятии",
  ]),
  premium: Object.freeze([
    "Приоритет при первоначальном выборе доступного постоянного времени",
    "Разумная помощь с короткими вопросами между занятиями",
    "Ответ в течение одного рабочего дня",
  ]),
});

const TOOLS = Object.freeze({
  basic: Object.freeze([]),
  standard: Object.freeze(["Quizlet", "ChatGPT Pro", "Codex"]),
  premium: Object.freeze(["Quizlet", "ChatGPT Pro", "Codex"]),
});

function lessonPackageLabel(lessons: 1 | 4 | 8): string {
  if (lessons === 1) return "1 занятие";
  if (lessons === 4) return "4 занятия";
  return "8 занятий";
}

export function offerDomainLegacyTariffs(): readonly LegacyTariffView[] {
  return (["basic", "standard", "premium"] as const).map((tariffId) => {
    const tariff = CURRENT_OFFER.tariffs[tariffId];
    const prices = ([1, 4, 8] as const)
      .flatMap((lessons) => tariff.packages[lessons]
        ? [{ lessons, label: lessonPackageLabel(lessons), price: formatRubles(tariff.packages[lessons]!.total) }]
        : []);
    const duration = tariff.duration.minimumMinutes === tariff.duration.maximumMinutes
      ? `${tariff.duration.minimumMinutes} минут`
      : `${tariff.duration.minimumMinutes}–${tariff.duration.maximumMinutes} минут`;
    return Object.freeze({
      id: tariff.id,
      name: tariff.legacyName,
      v7Name: tariff.publicLabel,
      duration,
      packageRule: tariffId === "premium" ? "Только пакеты" : "Можно выбрать одно занятие или пакет",
      prices: Object.freeze(prices),
      details: Object.freeze([
        duration,
        ...(tariffId === "premium" ? ["Только пакеты"] : []),
        ...prices.map((price) => `${price.label} — ${price.price}`),
      ]),
      fit: FIT[tariffId],
      reporting: REPORTING[tariffId],
      support: SUPPORT[tariffId],
      transferPolicy: TRANSFER_POLICY[tariffId],
      included: INCLUDED[tariffId],
      notes: NOTES[tariffId],
      tools: TOOLS[tariffId],
      collapsedSummary: Object.freeze([duration, `${prices[0]!.label} — ${prices[0]!.price}`]) as readonly [string, string],
      cta: Object.freeze(tariffId === "basic"
        ? { label: "Записаться", action: "book" as const }
        : tariffId === "standard"
          ? { label: "Узнать подробности", action: "details" as const }
          : { label: "Запланировать созвон", action: "call" as const }),
      ...(tariffId === "standard" ? { recommended: true } : {}),
    });
  });
}
