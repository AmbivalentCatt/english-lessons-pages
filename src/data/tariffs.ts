import { offerDomainLegacyTariffs } from "@/lib/offer-domain/adapters/legacy-tariffs";
import { resolveOfferDomainConsumer } from "@/lib/offer-domain/rollout";
import type { TariffId as OfferDomainTariffId } from "@/lib/offer-domain/identifiers";

export type TariffId = OfferDomainTariffId;

export type TariffName = "Basic" | "Standard" | "Premium";

export type TariffCtaAction = "book" | "details" | "call";

export type TariffCta = {
  label: string;
  action: TariffCtaAction;
};

export type TariffPrice = {
  lessons: 1 | 4 | 8;
  label: string;
  price: string;
};

export type Tariff = {
  id: TariffId;
  name: TariffName;
  v7Name: "BASIC" | "STANDARD" | "PRO";
  duration: string;
  packageRule: string;
  prices: TariffPrice[];
  details: string[];
  fit: string;
  reporting: string;
  support: string;
  transferPolicy: string;
  included: string[];
  notes: string[];
  tools: string[];
  collapsedSummary: [string, string];
  cta: TariffCta;
  recommended?: boolean;
};

export const legacyTariffs: Tariff[] = [
  {
    id: "basic",
    name: "Basic",
    v7Name: "BASIC",
    duration: "45–50 минут",
    packageRule: "Можно выбрать одно занятие или пакет",
    prices: [
      { lessons: 1, label: "1 занятие", price: "1 300 ₽" },
      { lessons: 4, label: "4 занятия", price: "4 600 ₽" },
      { lessons: 8, label: "8 занятий", price: "8 740 ₽" },
    ],
    details: [
      "45–50 минут",
      "1 занятие — 1 300 ₽",
      "4 занятия — 4 600 ₽",
      "8 занятий — 8 740 ₽",
    ],
    fit: "Для школьников и студентов, которым нужен самый гибкий выбор: одно занятие или пакет и минимум дополнительных сервисов.",
    reporting: "Без отдельного отчёта между занятиями.",
    support: "Вопросы и материал разбираются во время урока.",
    transferPolicy: "Переносы по инициативе ученика не входят. После закрепления постоянного слота добровольный возврат не предусмотрен — кроме прав, которые нельзя ограничить по закону.",
    included: [
      "Работа по школьной программе",
      "Помощь с домашними заданиями",
      "Компактный формат занятия",
    ],
    notes: [
      "Доступный компактный формат",
      "Без поддержки между занятиями",
    ],
    tools: [],
    collapsedSummary: ["45–50 минут", "1 занятие — 1 300 ₽"],
    cta: { label: "Записаться", action: "book" },
  },
  {
    id: "standard",
    name: "Standard",
    v7Name: "STANDARD",
    duration: "50–55 минут",
    packageRule: "Можно выбрать одно занятие или пакет",
    prices: [
      { lessons: 1, label: "1 занятие", price: "1 450 ₽" },
      { lessons: 4, label: "4 занятия", price: "5 200 ₽" },
      { lessons: 8, label: "8 занятий", price: "9 880 ₽" },
    ],
    details: [
      "50–55 минут",
      "1 занятие — 1 450 ₽",
      "4 занятия — 5 200 ₽",
      "8 занятий — 9 880 ₽",
    ],
    fit: "Рекомендуемый старт для большинства школьников и студентов, которым нужен системный общий английский по школьной программе, GoGetter или другому согласованному учебнику.",
    reporting: "Отчёт о сильных и слабых сторонах — раз в 4 занятия.",
    support: "Организационные ответы между уроками; учебные вопросы разбираются на занятии.",
    transferPolicy: "Один перенос на оплаченный пакет при предупреждении не менее чем за 24 часа.",
    included: [
      "Регулярные занятия",
      "Организационные ответы между занятиями",
      "Вопросы по материалу и домашнему заданию разбираются на занятии",
    ],
    notes: [
      "Организационные ответы между занятиями",
      "Вопросы по материалу и домашнему заданию разбираются на занятии",
    ],
    tools: ["Quizlet", "ChatGPT Pro", "Codex"],
    collapsedSummary: ["50–55 минут", "1 занятие — 1 450 ₽"],
    cta: { label: "Узнать подробности", action: "details" },
    recommended: true,
  },
  {
    id: "premium",
    name: "Premium",
    v7Name: "PRO",
    duration: "60 минут",
    packageRule: "Только пакеты",
    prices: [
      { lessons: 4, label: "4 занятия", price: "6 000 ₽" },
      { lessons: 8, label: "8 занятий", price: "11 400 ₽" },
    ],
    details: [
      "60 минут",
      "Только пакеты",
      "4 занятия — 6 000 ₽",
      "8 занятий — 11 400 ₽",
    ],
    fit: "Для школьников и студентов, которым нужны более строгая структура, повышенная вовлечённость, регулярный контроль и понятная картина прогресса.",
    reporting: "Персонализированный отчёт и трекинг после каждого занятия.",
    support: "Разумная помощь с короткими вопросами между занятиями; ответ в течение одного рабочего дня.",
    transferPolicy: "До двух переносов на оплаченный пакет при предупреждении не менее чем за 24 часа.",
    included: [
      "Разумная помощь с короткими вопросами между занятиями",
      "Ответ в течение одного рабочего дня",
      "Приоритет при первоначальном выборе доступного постоянного времени",
    ],
    notes: [
      "Приоритет при первоначальном выборе доступного постоянного времени",
      "Разумная помощь с короткими вопросами между занятиями",
      "Ответ в течение одного рабочего дня",
    ],
    tools: ["Quizlet", "ChatGPT Pro", "Codex"],
    collapsedSummary: ["60 минут", "4 занятия — 6 000 ₽"],
    cta: { label: "Запланировать созвон", action: "call" },
  },
];

function domainTariffsAsLegacyViews(): Tariff[] {
  return offerDomainLegacyTariffs().map((tariff) => ({
    ...tariff,
    prices: tariff.prices.map((price) => ({ ...price })),
    details: [...tariff.details],
    included: [...tariff.included],
    notes: [...tariff.notes],
    tools: [...tariff.tools],
    collapsedSummary: [...tariff.collapsedSummary],
    cta: { ...tariff.cta },
  }));
}

export const tariffs: Tariff[] = resolveOfferDomainConsumer("legacy-tariffs")
  ? domainTariffsAsLegacyViews()
  : legacyTariffs;

export const tariffsById = Object.fromEntries(
  tariffs.map((tariff) => [tariff.id, tariff]),
) as Record<TariffId, Tariff>;
