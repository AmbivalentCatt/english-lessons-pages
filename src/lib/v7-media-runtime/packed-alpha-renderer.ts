import {
  leaseForSession,
  type V7MediaAdapter,
  type V7MediaLease,
  type V7MediaState,
  V7MediaSurfaceSession,
} from "@/lib/v7-media-runtime/runtime";

export type V7PackedAlphaSurfaceSpec = Readonly<{
  kind: "packed-alpha";
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  onCanPlay: () => void;
  onError: () => void;
  onFirstFrame: () => void;
  onState?: (state: V7MediaState) => void;
}>;

export function connectPackedAlphaSurface(
  adapter: V7MediaAdapter,
  spec: V7PackedAlphaSurfaceSpec,
): V7MediaLease {
  const session = new V7MediaSurfaceSession(adapter, "packed-alpha", spec.onState);
  const { canvas, video } = spec;
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
    stencil: false,
  });
  if (!gl) {
    session.transition({ decode: "failed", presentation: "poster", failure: "webgl-unavailable" });
    spec.onError();
    return leaseForSession(session);
  }

  const vertexSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_texCoord;
    void main() {
      vec3 color = texture2D(u_texture, vec2(v_texCoord.x * 0.5, v_texCoord.y)).rgb;
      float rawAlpha = texture2D(u_texture, vec2(0.5 + v_texCoord.x * 0.5, v_texCoord.y)).r;
      float alpha = smoothstep(0.012, 0.988, rawAlpha);
      gl_FragColor = vec4(color * alpha, alpha);
    }
  `;
  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    session.transition({ decode: "failed", presentation: "poster", failure: "webgl-program-create" });
    spec.onError();
    return leaseForSession(session);
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    session.transition({ decode: "failed", presentation: "poster", failure: "webgl-program-link" });
    spec.onError();
    return leaseForSession(session);
  }

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture || positionLocation < 0 || texCoordLocation < 0) {
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    session.transition({ decode: "failed", presentation: "poster", failure: "webgl-buffer-texture" });
    spec.onError();
    return leaseForSession(session);
  }

  canvas.width = 2;
  canvas.height = 2;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 0,
     1, -1, 1, 0,
    -1,  1, 0, 1,
    -1,  1, 0, 1,
     1, -1, 1, 0,
     1,  1, 1, 1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  let firstFrameDrawn = false;
  let cancelFrame: (() => void) | null = null;
  const stopFrames = () => {
    cancelFrame?.();
    cancelFrame = null;
  };
  const fail = (reason: string) => {
    stopFrames();
    session.transition({ decode: "failed", presentation: "poster", failure: reason });
    spec.onError();
  };
  const drawFrame = () => {
    if (video.readyState < 2 || video.videoWidth < 2) return;
    try {
      const decodedWidth = Math.max(2, Math.round(video.videoWidth / 2));
      const decodedHeight = Math.max(2, video.videoHeight);
      if (canvas.width !== decodedWidth || canvas.height !== decodedHeight) {
        canvas.width = decodedWidth;
        canvas.height = decodedHeight;
        gl.viewport(0, 0, decodedWidth, decodedHeight);
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!firstFrameDrawn) {
        firstFrameDrawn = true;
        canvas.dataset.frameReady = "true";
        session.transition({ decode: "frame-ready", presentation: "video", failure: null });
        spec.onFirstFrame();
      }
    } catch {
      fail("webgl-frame-draw");
    }
  };
  const scheduleFrame = () => {
    stopFrames();
    if (video.paused || video.ended || !adapter.documentVisible()) return;
    cancelFrame = session.mediaFrame(video, () => {
      cancelFrame = null;
      drawFrame();
      scheduleFrame();
    });
  };
  const handleLoadedData = () => {
    drawFrame();
    scheduleFrame();
  };
  const handleCanPlay = () => {
    session.transition({ decode: "can-play" });
    spec.onCanPlay();
    drawFrame();
  };
  const handlePause = () => {
    stopFrames();
    drawFrame();
  };
  const handleVisibility = () => {
    session.transition({ documentVisible: adapter.documentVisible() });
    if (adapter.documentVisible()) {
      drawFrame();
      scheduleFrame();
    } else {
      stopFrames();
    }
  };
  const handleContextLost = (event: Event) => {
    event.preventDefault();
    fail("webgl-context-lost");
  };

  session.own(adapter.listen(video, "loadeddata", handleLoadedData as EventListener));
  session.own(adapter.listen(video, "canplay", handleCanPlay as EventListener));
  session.own(adapter.listen(video, "seeked", drawFrame as EventListener));
  session.own(adapter.listen(video, "play", scheduleFrame as EventListener));
  session.own(adapter.listen(video, "pause", handlePause as EventListener));
  session.own(adapter.observeDocumentVisibility(handleVisibility));
  session.own(adapter.listen(canvas, "webglcontextlost", handleContextLost as EventListener));
  session.own(() => stopFrames());
  session.own(() => {
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  });
  if (video.readyState >= 2) handleLoadedData();
  return leaseForSession(session);
}
