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

test("loads interactive Liquid and retains it through the tariff journey", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./");
  const model = page.locator("[data-liquid-model]");
  await expect(model).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(model).toHaveAttribute("data-model-quality", "web");
  await expect(model).toHaveAttribute("data-clips", "Liquid_Idle,Liquid_Gaze");
  await expect(page.locator('[data-reveal-state="complete"]')).toBeVisible();
  for (const time of [21.8, 26.6, 28.2, 31.4, 21.8]) {
    await page.evaluate(referenceTime => {
      window.dispatchEvent(new CustomEvent("liquid-v7:navigate-to-reference", {
        detail: {referenceTime, immediate:true},
      }));
    }, time);
    await expect.poll(() => page.locator("[data-liquid-motion-rig]").evaluate(el => Number((el as HTMLElement).dataset.referenceTime))).toBeCloseTo(time, 1);
    await expect(model).toHaveAttribute("data-ready", "true");
    await expect(model).toHaveAttribute("data-paused", "false");
  }
  const stage = page.locator("[data-motion-ready]");
  expect(await stage.evaluate(el => getComputedStyle(el).overflow)).toBe("clip");
  if (isMobile) {
    const viewport = page.viewportSize()!;
    const before = await page.evaluate(() => scrollY);
    await page.setViewportSize({...viewport, height:viewport.height-60});
    await expect.poll(() => page.evaluate(() => Math.abs(scrollY))).toBeGreaterThan(1000);
    await expect.poll(() => page.evaluate(y => Math.abs(scrollY-y), before)).toBeLessThan(2);
    await expect(stage).not.toHaveAttribute("data-reveal-mode", "viewport-restored");
  }
  await expect(page.locator('[data-testid="liquid-reference-v7-video"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("loads the repository subpath with local assets and no leaking root asset requests", async ({ page }) => {
  const rootAssetRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && /^\/(?:assets|media|mascot)\//.test(url.pathname)) {
      rootAssetRequests.push(url.pathname);
    }
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.locator('[data-reveal-state="complete"] header').getByRole("link", { name: "На главную — Хелл оу...", exact: true }),
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
    page.locator('[data-reveal-state="complete"] header').getByRole("link", { name: "На главную — Хелл оу...", exact: true }),
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

test("opt-in phone tilt drives existing depth and Liquid, then resets safely", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "Device sensors are offered only on touch devices.");
  // Controlled sensor/permission input; this is not a physical-device sensor test.
  await page.addInitScript(() => {
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", {
      configurable: true, value: async () => "granted",
    });
    const orientation = new EventTarget();
    Object.defineProperty(orientation, "angle", { configurable: true, value: 0 });
    Object.defineProperty(screen, "orientation", { configurable: true, value: orientation });
  });
  await page.goto("./");
  await expect(page.locator('[data-reveal-state="complete"]')).toBeVisible();
  const model = page.locator('[data-liquid-model]');
  await expect(model).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  const control = page.getByRole('button', { name: 'Наклон устройства', exact: true });
  const send = (beta: number, gamma: number) => page.evaluate(({ beta, gamma }) => {
    const event = new Event('deviceorientation');
    Object.defineProperties(event, { beta: { value: beta }, gamma: { value: gamma } });
    dispatchEvent(event);
  }, { beta, gamma });
  await send(45, 0);
  await expect(model).toHaveAttribute('data-mode', 'follow');
  await control.tap();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await send(45, 0); // Calibrate to the visitor's current grip.
  await send(48, 16);
  await expect(model).toHaveAttribute('data-mode', 'tilt');
  await expect.poll(() => model.getAttribute('data-eye-x').then(Number)).toBeGreaterThan(.25);
  await expect.poll(() => page.locator('[class*=phoneDepthRig]').evaluate(el => Number((el as HTMLElement).style.getPropertyValue('--scene-x')))).toBeGreaterThan(.4);
  await page.evaluate(() => dispatchEvent(new CustomEvent('liquid-v7:navigate-to-reference', {
    detail: { referenceTime: 21.8, immediate: true },
  })));
  await expect.poll(() => page.locator('[data-liquid-motion-rig]').getAttribute('data-reference-time').then(Number)).toBeCloseTo(21.8, 1);
  const surfaces = page.locator('[class*=phoneDepthRig], [class*=cardDepthRig]');
  await expect(surfaces).toHaveCount(5);
  const transforms = () => surfaces.evaluateAll(elements => elements.map(element => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42, yaw: matrix.m13 };
  }));
  await expect.poll(async () => (await transforms()).every(matrix => matrix.x > 1.5 && Math.abs(matrix.yaw) > .02)).toBe(true);
  const right = await transforms();
  expect(new Set(right.map(matrix => matrix.x.toFixed(2))).size).toBe(5);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', {
    pointerType: 'touch', relatedTarget: null, bubbles: true,
  })));
  await page.waitForTimeout(200);
  expect((await transforms()).every(matrix => matrix.x > 1.5)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('phone-five-cards-tilt-right.png') });
  await send(43, -16);
  await expect.poll(async () => (await transforms()).every(matrix => matrix.x < -1.5)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('phone-five-cards-tilt-left.png') });
  await page.evaluate(() => dispatchEvent(new CustomEvent('liquid-v7:navigate-to-reference', {
    detail: { referenceTime: 31.4, immediate: true },
  })));
  await expect.poll(() => page.locator('[data-liquid-motion-rig]').getAttribute('data-reference-time').then(Number)).toBeCloseTo(31.4, 1);
  await expect.poll(() => page.locator('[class*=proofDepthRig]').evaluateAll(elements =>
    elements.every(element => new DOMMatrix(getComputedStyle(element).transform).m41 < -1.5))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('phone-pro-proof-tilt.png') });
  await page.evaluate(() => dispatchEvent(new CustomEvent('liquid-v7:navigate-to-reference', { detail: { referenceTime: 0, immediate: true } })));
  await expect(control).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(screen.orientation, "angle", { configurable: true, value: 90 });
    dispatchEvent(new Event('orientationchange'));
  });
  await send(12, -25);
  await expect.poll(() => page.locator('[class*=phoneDepthRig]').evaluate(el => Number((el as HTMLElement).style.getPropertyValue('--scene-x')))).toBeCloseTo(0, 2);
  await send(100, -25);
  await expect.poll(() => page.locator('[class*=phoneDepthRig]').evaluate(el => Number((el as HTMLElement).style.getPropertyValue('--scene-x')))).toBeCloseTo(.65, 2);
  await control.tap();
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await expect(model).toHaveAttribute('data-mode', 'follow');
  await send(20, 60);
  await expect(page.locator('[data-liquid-v7-main]')).toHaveAttribute('data-device-tilt', 'false');
  await control.tap();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(control).toHaveCount(0);
  await expect(model).toHaveAttribute('data-paused', 'true');
});

test("denied phone sensor permission leaves the normal page usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Device sensors are offered only on touch devices.");
  await page.addInitScript(() => {
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => "denied" });
  });
  await page.goto("./");
  await expect(page.locator('[data-reveal-state="complete"]')).toBeVisible();
  const control = page.getByRole('button', { name: 'Наклон устройства', exact: true });
  await control.tap();
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await expect(control).toHaveText('Наклон недоступен');
  await page.getByRole('link', { name: 'Перейти к выбору тарифа и заявке на урок', exact: true }).tap();
  await expect(page.locator('[data-booking-arrival="true"]')).toBeAttached();
});


test("restores the scroll scene when a static reload waits for the application script", async ({ page, isMobile }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-reveal-state="complete"]')).toBeVisible();
  await page.evaluate(() => {
    const sequence = document.querySelector<HTMLElement>('[data-testid="liquid-reference-v7-sequence"]')!;
    window.scrollTo({ top: sequence.offsetTop + (sequence.offsetHeight - innerHeight) * .75, behavior: "instant" });
  });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  const previousY = await page.evaluate(() => scrollY);
  await page.route("**/assets/index-*.js", async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-reveal-state="complete"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(previousY, 0);
  await expect(page.locator('[data-liquid-motion-rig]')).toBeVisible();
  if (isMobile) await page.touchscreen.tap(5, 5);
  else await page.keyboard.press("Shift");
  await expect.poll(() => page.evaluate(() => history.scrollRestoration)).toBe("auto");
  // Release history ownership without a pending native key-scroll animation,
  // then verify that a subsequent scene seek is not overwritten.
  await page.evaluate(y => scrollTo({ top: y - 500, behavior: "instant" }), previousY);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(previousY - 500, 0);
});
