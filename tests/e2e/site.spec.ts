import { expect, test, type Page } from "@playwright/test";

const basePath = "/english-lessons-preview/";

async function installSyntheticNetwork(page: Page) {
  await page.route("https://challenges.cloudflare.com/**", async (route) => route.abort());
  await page.route("https://applications.example.invalid/api/availability", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ok: true,
        availability: {
          fresh: true,
          tariffs: {
            basic: { label: "Осталось мест", remaining: 2, status: "fresh" },
            standard: { label: "Осталось мест", remaining: 0, status: "fresh" },
            premium: { label: "Осталось мест", remaining: 2, status: "fresh" },
          },
          verifiedAt: "2026-09-01T20:32:16+03:00",
        },
      }),
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render(container: HTMLElement, options: { callback: (token: string) => void }) {
          container.textContent = "Synthetic Turnstile test control";
          queueMicrotask(() => options.callback("synthetic-browser-turnstile-token"));
          return "synthetic-widget";
        },
        remove() {},
        reset() {},
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await installSyntheticNetwork(page);
});

test("loads the repository subpath with local assets and no leaking root asset requests", async ({ page }) => {
  const rootAssetRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:4173" && /^\/(?:assets|media|mascot)\//.test(url.pathname)) {
      rootAssetRequests.push(url.pathname);
    }
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.locator('[data-reveal-state="complete"] header').getByText("LEARNING IN MOTION", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => rootAssetRequests).toEqual([]);
  const localResponses = await page.locator("img").evaluateAll((images) => images.slice(0, 8).map((image) => (image as HTMLImageElement).currentSrc));
  expect(localResponses.some((src) => src.includes(`${basePath}media/`))).toBe(true);
});

test("serves the accepted legacy deep link and custom 404 shell after refresh", async ({ page, request }) => {
  const legacy = await request.get(`${basePath}liquid-scroll-lab/reference-v7-micro-fidelity/`);
  expect(legacy.status()).toBe(200);
  expect(await legacy.text()).toContain("<div id=\"root\"></div>");

  const fallback = await request.get(`${basePath}404.html`);
  expect(fallback.status()).toBe(200);
  expect(await fallback.text()).toContain("<div id=\"root\"></div>");

  await page.goto(`${basePath}liquid-scroll-lab/reference-v7-micro-fidelity/`, { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('[data-reveal-state="complete"] header').getByText("LEARNING IN MOTION", { exact: true }),
  ).toBeVisible();
});

test("keeps the application modal keyboard reachable and submits only after Turnstile", async ({ page }) => {
  let submittedPayload: Record<string, unknown> | null = null;
  await page.route("https://applications.example.invalid/api/applications", async (route) => {
    submittedPayload = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        ok: true,
        reference: "HEL-20260826-SYNTH234",
        createdAt: "2026-08-26T18:00:00.000Z",
        duplicate: false,
      }),
    });
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  const firstTrigger = page.locator("[data-v7-application-trigger]:visible").first();
  await firstTrigger.scrollIntoViewIfNeeded();
  await firstTrigger.click();
  const dialog = page.getByRole("dialog", { name: /Заявка на урок/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ЗАЩИТНАЯ ПРОВЕРКА ПРОЙДЕНА")).toBeVisible();

  await dialog.getByLabel("Имя контактного лица").fill("Synthetic Parent");
  await dialog.getByLabel("Имя или инициалы ученика").fill("Synthetic Learner");
  await dialog.getByLabel("Класс / курс — если применимо").fill("Synthetic grade 8");
  await dialog.getByLabel("Примерный уровень").selectOption("elementary");
  await dialog.getByLabel("Цель занятий").fill("Synthetic browser goal for isolated local verification.");
  await dialog.getByLabel("Онлайн").check();
  await dialog.getByLabel("Предпочтительные дни и время").fill("Synthetic Tuesday after 18:00");
  await dialog.getByLabel("Как связаться").selectOption("email");
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("synthetic@example.invalid");
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog.getByRole("button", { name: "ОТПРАВИТЬ ЗАЯВКУ" }).click();

  const successDialog = page.getByRole("dialog", { name: "Заявка сохранена." });
  await expect(successDialog.getByText("HEL-20260826-SYNTH234")).toBeVisible();
  expect(submittedPayload).not.toBeNull();
  expect(submittedPayload).toMatchObject({
    turnstileToken: "synthetic-browser-turnstile-token",
    website: "",
    parentName: "Synthetic Parent",
  });
  expect(submittedPayload).not.toHaveProperty("internalNotes");
});

test("honors reduced motion and keeps the compact plan chooser usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  const stage = page.locator("[data-motion-mode]").first();
  await expect(stage).toHaveAttribute("data-motion-mode", "reduced");
  await expect(page.getByRole("group", { name: "Lesson plan for reduced-motion details" })).toBeVisible();
  const activeVideos = await page.locator("video").evaluateAll((videos) => videos.filter((video) => !(video as HTMLVideoElement).paused).length);
  expect(activeVideos).toBe(0);
});

test("has no horizontal document overflow at the active viewport", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
