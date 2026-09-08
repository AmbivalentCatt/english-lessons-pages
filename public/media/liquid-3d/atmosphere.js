import * as THREE from './vendor/three.module.js';

// The model already contains painted light and shadow. These small additions
// bring the surrounding scene into that paint without lighting it twice.
const palettes = {
  lagoon: { ambient: [.62, .70, .72], key: [.19, .18, .16], bounce: [.015, .11, .13], rim: [.025, .065, .08] },
  peach: { ambient: [.82, .78, .73], key: [.22, .21, .19], bounce: [.12, .055, .025], rim: [.08, .042, .021] },
  violet: { ambient: [.73, .68, .79], key: [.19, .18, .20], bounce: [.075, .03, .13], rim: [.07, .035, .10] },
  sky: { ambient: [.79, .85, .88], key: [.19, .20, .21], bounce: [.02, .08, .12], rim: [.035, .07, .085] },
  pro: { ambient: [.67, .61, .73], key: [.22, .20, .23], bounce: [.08, .025, .14], rim: [.085, .04, .125] },
  night: { ambient: [.61, .65, .73], key: [.19, .19, .20], bounce: [.025, .045, .10], rim: [.035, .05, .09] },
};

// The same reference seconds as the existing background transitions. Blend
// while the new field enters, in either scroll direction; never own the route.
const transitions = [
  [10.2, 11.9, 'peach'],
  [23, 24.25, 'violet'],
  [25.55, 26.2, 'sky'],
  [27.75, 28.8, 'pro'],
  [32.25, 33.1, 'night'],
];
const channels = ['ambient', 'key', 'bounce', 'rim'];
const uniformName = channel => `liquidAtmosphere${channel[0].toUpperCase()}${channel.slice(1)}`;

export function createLiquidAtmosphere(stage, rig) {
  const uniforms = Object.fromEntries(channels.map(channel => [uniformName(channel), { value: new THREE.Vector3(...palettes.lagoon[channel]) }]));
  uniforms.liquidAtmosphereKeyDirection = { value: new THREE.Vector3(-.45, .7, 1).normalize() };
  uniforms.liquidAtmosphereBounceDirection = { value: new THREE.Vector3(.85, -.25, .4).normalize() };
  const targets = Object.fromEntries(channels.map(channel => [channel, new THREE.Vector3()]));
  let initialized = false;

  function update(dt, immediate = false) {
    const time = Number(rig?.dataset.referenceTime || 0);
    let from = 'lagoon', to = from, blend = 0;
    for (const [start, end, name] of transitions) {
      if (time < start) break;
      if (time >= end) { from = name; to = name; blend = 0; continue; }
      to = name;
      const u = (time - start) / (end - start);
      blend = u * u * (3 - 2 * u);
      break;
    }
    // A short settling time also softens wheel jumps and programmatic tier
    // navigation. Reduced motion and the initial restored scene settle at once.
    const weight = immediate || !initialized ? 1 : 1 - Math.exp(-dt / .16);
    for (const channel of channels) {
      const a = palettes[from][channel], b = palettes[to][channel];
      targets[channel].set(...a.map((value, i) => THREE.MathUtils.lerp(value, b[i], blend)));
      uniforms[uniformName(channel)].value.lerp(targets[channel], weight);
    }
    initialized = true;
    stage.dataset.lightingScene = from === to ? from : `${from}-${to}`;
    stage.dataset.lightingBlend = blend.toFixed(3);
    stage.dataset.lightingAmbient = uniforms.liquidAtmosphereAmbient.value.toArray().map(v => v.toFixed(4)).join(',');
  }

  function apply(material) {
    // Preserve the approved eyelid/iris shader patches before adding light.
    const paintShader = material.onBeforeCompile;
    const paintKey = material.customProgramCacheKey();
    material.onBeforeCompile = shader => {
      paintShader.call(material, shader);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 liquidAtmosphereNormal;\nvarying vec3 liquidAtmosphereView;')
        .replace('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )', '#if 1')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nliquidAtmosphereNormal = transformedNormal;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nliquidAtmosphereView = -mvPosition.xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 liquidAtmosphereNormal;
varying vec3 liquidAtmosphereView;
uniform vec3 liquidAtmosphereAmbient;
uniform vec3 liquidAtmosphereKey;
uniform vec3 liquidAtmosphereBounce;
uniform vec3 liquidAtmosphereRim;
uniform vec3 liquidAtmosphereKeyDirection;
uniform vec3 liquidAtmosphereBounceDirection;`)
        .replace('#include <opaque_fragment>', `
vec3 atmosphereNormal = normalize(liquidAtmosphereNormal);
if (!gl_FrontFacing) atmosphereNormal = -atmosphereNormal;
float keyLight = max(dot(atmosphereNormal, liquidAtmosphereKeyDirection), 0.0);
float bounceLight = pow(max(dot(atmosphereNormal, liquidAtmosphereBounceDirection), 0.0), 1.5);
float edgeLight = pow(1.0 - max(dot(atmosphereNormal, normalize(liquidAtmosphereView)), 0.0), 2.5);
// Reflected light follows the actual facets and turns with the head. Limit it
// in black painted cavities, and preserve the original bright eye highlights.
float paintLuminance = dot(outgoingLight, vec3(.2126, .7152, .0722));
float reflectionMask = smoothstep(.018, .22, paintLuminance);
vec3 atmosphereLight = liquidAtmosphereAmbient + liquidAtmosphereKey * keyLight + liquidAtmosphereBounce * bounceLight;
outgoingLight *= atmosphereLight;
outgoingLight += liquidAtmosphereRim * edgeLight * reflectionMask;
#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `${paintKey}-atmosphere-1`;
    return material;
  }

  return { apply, update };
}
