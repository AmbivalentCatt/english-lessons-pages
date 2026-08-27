import type { V7FooterMaterialRenderer } from "@/lib/v7-media-runtime/surfaces";

export function createFooterMaterialRenderer(
  brand: HTMLElement,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  text: string,
): V7FooterMaterialRenderer {
  const glyphMaskCanvas = document.createElement("canvas");
  brand.dataset.materialRenderer = "single-layer";
  brand.dataset.materialMode = "source-video";

  const clear = () => {
    const context = canvas.getContext("2d");
    if (context) context.clearRect(0, 0, canvas.width, canvas.height);
    brand.dataset.materialReady = "false";
  };

  const draw = () => {
    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      || !video.videoWidth
      || !video.videoHeight
    ) {
      clear();
      return false;
    }

    const bounds = brand.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    if (glyphMaskCanvas.width !== pixelWidth || glyphMaskCanvas.height !== pixelHeight) {
      glyphMaskCanvas.width = pixelWidth;
      glyphMaskCanvas.height = pixelHeight;
    }

    const context = canvas.getContext("2d");
    const glyphMaskContext = glyphMaskCanvas.getContext("2d");
    if (!context || !glyphMaskContext) return false;
    const computed = window.getComputedStyle(brand);
    const width = bounds.width;
    const height = bounds.height;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    glyphMaskContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    glyphMaskContext.clearRect(0, 0, width, height);

    glyphMaskContext.font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
    glyphMaskContext.textAlign = "left";
    glyphMaskContext.textBaseline = "alphabetic";
    const metrics = glyphMaskContext.measureText(text);
    const fontAscent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent;
    const fontDescent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent;
    const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 0.84;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0;
    const baseline = paddingTop + (lineHeight - fontAscent - fontDescent) / 2 + fontAscent;
    const tracking = Number.parseFloat(computed.letterSpacing) || 0;
    glyphMaskContext.fillStyle = "#fff";
    glyphMaskContext.strokeStyle = "#fff";
    glyphMaskContext.lineJoin = "round";
    glyphMaskContext.lineWidth = Math.max(1.25, Number.parseFloat(computed.fontSize) * 0.016);
    let glyphX = paddingLeft - glyphMaskContext.measureText(text[0]).actualBoundingBoxLeft;
    Array.from(text).forEach((glyph, index, glyphs) => {
      glyphMaskContext.strokeText(glyph, glyphX, baseline);
      glyphMaskContext.fillText(glyph, glyphX, baseline);
      glyphX += glyphMaskContext.measureText(glyph).width;
      if (index < glyphs.length - 1) glyphX += tracking;
    });

    // Preserve the accepted crop that excludes the source diamond.
    const safeTop = video.videoHeight * 0.14;
    const safeBottom = video.videoHeight * 0.58;
    const safeHeight = safeBottom - safeTop;
    const targetAspect = width / height;
    let sourceWidth = video.videoWidth;
    let sourceHeight = sourceWidth / targetAspect;
    let sourceX = 0;
    let sourceY = safeTop + (safeHeight - sourceHeight) / 2;
    if (sourceHeight > safeHeight) {
      sourceHeight = safeHeight;
      sourceWidth = sourceHeight * targetAspect;
      sourceX = (video.videoWidth - sourceWidth) / 2;
      sourceY = safeTop;
    }

    try {
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
      context.globalCompositeOperation = "destination-in";
      context.drawImage(glyphMaskCanvas, 0, 0, pixelWidth, pixelHeight, 0, 0, width, height);
    } catch {
      clear();
      return false;
    }
    context.globalCompositeOperation = "source-over";
    brand.dataset.materialReady = "true";
    return true;
  };

  return {
    clear,
    draw,
    dispose: clear,
  };
}
