import { expect, test } from '@playwright/test';

for (const reduced of [false, true]) {
  test(`loader waits for an actual Liquid frame${reduced ? ' with reduced motion' : ''}`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    let release!: () => void;
    const delayed = new Promise<void>(resolve => { release = resolve; });
    await page.route(/Liquid-animated.*\.glb(?:\.gz)?$/, async route => {
      await delayed;
      await route.continue();
    });
    await page.addInitScript(() => {
      const evidence: { state: string; ready: string | undefined }[] = [];
      Object.assign(window, { revealEvidence: evidence });
      new MutationObserver(() => {
        const stage = document.querySelector<HTMLElement>('[data-reveal-state]');
        if (stage && ['assembling', 'complete'].includes(stage.dataset.revealState ?? '')) {
          if (!evidence.some(e => e.state === stage.dataset.revealState)) evidence.push({
            state: stage.dataset.revealState!, ready: document.querySelector<HTMLElement>('[data-liquid-model]')?.dataset.ready,
          });
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-reveal-state'] });
    });
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    const model = page.locator('[data-liquid-model]');
    const stage = page.locator('[data-motion-ready]');
    try {
      await expect(model).toHaveAttribute('data-load-state', 'fetching');
      // Longer than the old 2.8s image-only budget and opening assembly.
      await page.waitForTimeout(4300);
      await expect(stage).toHaveAttribute('data-reveal-state', 'pending');
      await expect(model).toHaveAttribute('data-ready', 'false');
      await expect(page.locator('[class*=runtime]').first()).toHaveAttribute('inert', '');
      await page.screenshot({ path: testInfo.outputPath('waiting-for-liquid.png') });
    } finally { release(); }
    await expect(stage).toHaveAttribute('data-reveal-state', 'complete', { timeout: 60_000 });
    await expect(model).toHaveAttribute('data-ready', 'true');
    await expect(model).toHaveAttribute('data-load-state', 'ready');
    const evidence = await page.evaluate(() => (window as unknown as Window & { revealEvidence: { state: string; ready: string }[] }).revealEvidence);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every(e => e.ready === 'true')).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('ready-with-interactive-liquid.png') });
  });
}

test('failed module load offers a working retry instead of silently showing old Liquid', async ({ page }) => {
  test.setTimeout(90_000);
  let fail = true;
  await page.route(/liquid-3d\/runtime\.js\?/, route => fail
    ? route.fulfill({ status: 503, contentType: 'text/javascript', body: '' }) : route.continue());
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Liquid could not load. Please retry.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-motion-ready]')).toHaveAttribute('data-reveal-state', 'pending');
  await expect(page.locator('[data-liquid-model]')).toHaveCount(1);
  fail = false;
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await expect(page.locator('[data-reveal-state=complete]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-liquid-model]')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Retry loading', exact: true })).toHaveCount(0);
});
