import { expect, test } from '@playwright/test';

test('Liquid eye rendering survives a GPU without float-linear filtering', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/__eye-render', route => route.fulfill({ contentType: 'text/html', body: `
    <style>body{margin:0;background:#183538}#rig{position:fixed;left:0;top:40px;width:300px;height:300px}
    #model{position:absolute;inset:0}canvas{position:absolute;left:0;top:calc((1 - var(--liquid-viewport-scale,1))*50%);width:100%;height:calc(var(--liquid-viewport-scale,1)*100%)}</style>
    <div id="rig" data-liquid-motion-rig data-reference-time="0"></div>` }));
  await page.goto('./__eye-render');
  const frames: string[] = [];
  for (const blockExtension of [false, true]) {
    await page.evaluate(async block => {
      const original = WebGL2RenderingContext.prototype.getExtension;
      WebGL2RenderingContext.prototype.getExtension = function(name: string) {
        return block && name === 'OES_texture_float_linear' ? null : original.call(this, name);
      };
      const stage = document.createElement('div'); stage.id = 'model';
      document.querySelector('#rig')!.append(stage);
      const runtimeUrl = new URL('media/liquid-3d/runtime.js?v=eyes-test', location.href).href;
      const { mountLiquidModel } = await import(/* @vite-ignore */ runtimeUrl);
      const handle = mountLiquidModel(stage, { onError(error: unknown) { throw error; } });
      (window as Window & { disposeEyes?: () => void }).disposeEyes = () => {
        handle.dispose(); stage.remove(); WebGL2RenderingContext.prototype.getExtension = original;
      };
    }, blockExtension);
    await expect(page.locator('#model')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
    frames.push((await page.locator('#rig').screenshot()).toString('base64'));
    await page.evaluate(() => (window as Window & { disposeEyes?: () => void }).disposeEyes!());
  }
  // Compare actual rendered pixels, not merely a successful load flag: the
  // original iPhone defect painted over pupils while still reporting ready.
  const difference = await page.evaluate(async images => {
    const pixels = await Promise.all(images.map(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    }));
    let changed = 0;
    for (let i = 0; i < pixels[0].length; i += 4) {
      if (Math.max(...[0, 1, 2].map(c => Math.abs(pixels[0][i + c] - pixels[1][i + c]))) > 12) changed++;
    }
    return changed;
  }, frames);
  expect(difference).toBeLessThan(30);
});
