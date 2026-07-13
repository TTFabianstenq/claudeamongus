/**
 * Custom GLSL shaders: storm sky dome, rain particles, drifting dust motes,
 * the flashlight's volumetric cone, ground mist sheets, and a wind-sway
 * vertex injection for vegetation.
 */

import * as THREE from 'three';

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(19.7, 7.3);
      a *= 0.5;
    }
    return v;
  }
`;

/* ------------------------------------------------------------------ */
/* Storm sky dome                                                      */
/* ------------------------------------------------------------------ */

export function makeSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uLightning: { value: 0 },
      uWind: { value: 0.4 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w; // pin to far plane
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime;
      uniform float uLightning;
      uniform float uWind;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.05, 1.0);
        // Night gradient
        vec3 horizon = vec3(0.045, 0.05, 0.07);
        vec3 zenith = vec3(0.008, 0.01, 0.018);
        vec3 col = mix(horizon, zenith, pow(h + 0.05, 0.55));
        // Rolling storm cloud layers
        vec2 uv = d.xz / (0.25 + d.y);
        float t = uTime * 0.012 * (0.5 + uWind);
        float clouds = fbm(uv * 1.4 + vec2(t * 2.0, t * 0.6));
        clouds += 0.5 * fbm(uv * 3.1 - vec2(t * 3.4, t));
        float cloudMask = smoothstep(0.55, 1.25, clouds) * smoothstep(-0.02, 0.22, d.y);
        vec3 cloudCol = mix(vec3(0.05, 0.055, 0.07), vec3(0.1, 0.1, 0.12), clouds * 0.5);
        col = mix(col, cloudCol, cloudMask * 0.9);
        // Moon glow bleeding through cover
        vec3 moonDir = normalize(vec3(-0.35, 0.52, -0.62));
        float moon = pow(max(dot(d, moonDir), 0.0), 380.0);
        float halo = pow(max(dot(d, moonDir), 0.0), 18.0);
        col += vec3(0.7, 0.75, 0.85) * moon * (1.0 - cloudMask * 0.85);
        col += vec3(0.08, 0.09, 0.12) * halo * (1.0 - cloudMask * 0.5);
        // Lightning: illuminate cloud undersides
        col += vec3(0.65, 0.7, 0.9) * uLightning * (0.25 + cloudMask) * smoothstep(-0.05, 0.35, d.y);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Rain                                                                */
/* ------------------------------------------------------------------ */

export function makeRainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uWind: { value: 0.3 },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uWind;
      uniform vec3 uCam;
      varying float vAlpha;
      void main() {
        // Each point falls in a 24m column that wraps around the camera.
        float fallSpeed = 14.0 + aSeed * 6.0;
        vec3 p = position;
        float span = 24.0;
        p.y = mod(position.y - uTime * fallSpeed, span);
        // wrap XZ into a box centred on the camera
        p.x = mod(position.x + uWind * uTime * 6.0 - uCam.x + 20.0, 40.0) - 20.0 + uCam.x;
        p.z = mod(position.z - uCam.z + 20.0, 40.0) - 20.0 + uCam.z;
        p.x += uWind * p.y * 0.22;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        gl_PointSize = clamp(60.0 / dist, 1.5, 7.0);
        vAlpha = smoothstep(38.0, 6.0, dist) * (0.35 + aSeed * 0.3);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        // vertical streak falloff
        float streak = 1.0 - smoothstep(0.0, 0.5, abs(uv.y));
        float core = 1.0 - smoothstep(0.0, 0.12, abs(uv.x));
        float a = streak * core * vAlpha * uIntensity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.62, 0.68, 0.78, a);
      }
    `,
  });
}

export function makeRainGeometry(count: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = Math.random() * 24;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geo;
}

/* ------------------------------------------------------------------ */
/* Dust motes                                                          */
/* ------------------------------------------------------------------ */

export function makeDustMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uLightPos: { value: new THREE.Vector3(0, -100, 0) },
      uLightDir: { value: new THREE.Vector3(0, 0, -1) },
      uLightOn: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform vec3 uCam;
      uniform vec3 uLightPos;
      uniform vec3 uLightDir;
      uniform float uLightOn;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.05 + aSeed * 0.06);
        p.x += sin(t * 2.1 + aSeed * 40.0) * 0.5;
        p.y += sin(t * 1.3 + aSeed * 17.0) * 0.35;
        p.z += cos(t * 1.7 + aSeed * 29.0) * 0.5;
        // wrap into an 12m box around the camera
        p = mod(p - uCam + 6.0, 12.0) - 6.0 + uCam;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        gl_PointSize = clamp(9.0 / dist, 0.8, 3.2);
        // Motes glow inside the flashlight cone
        vec3 toP = p - uLightPos;
        float along = dot(toP, uLightDir);
        float radial = length(toP - uLightDir * along);
        float cone = uLightOn * smoothstep(0.5, 0.05, radial / max(along * 0.42, 0.001)) * step(0.2, along) * smoothstep(9.0, 2.0, along);
        vAlpha = (0.05 + cone * 0.55) * smoothstep(8.0, 3.0, dist);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vAlpha;
        if (a < 0.004) discard;
        gl_FragColor = vec4(0.82, 0.78, 0.68, a);
      }
    `,
  });
}

export function makeDustGeometry(count: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = Math.random() * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geo;
}

/* ------------------------------------------------------------------ */
/* Volumetric flashlight cone                                          */
/* ------------------------------------------------------------------ */

export function makeConeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uIntensity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      uniform float uIntensity;
      void main() {
        // fade along the cone length + at grazing angles (fake volumetric)
        float len = 1.0 - vUv.y;
        float axial = pow(1.0 - len, 1.6);
        float fresnel = abs(dot(normalize(vViewNormal), normalize(-vViewPos)));
        float a = axial * (0.35 + fresnel * 0.65) * uIntensity * 0.16;
        gl_FragColor = vec4(1.0, 0.92, 0.72, a);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Ground mist sheets                                                  */
/* ------------------------------------------------------------------ */

export function makeMistMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.35 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      ${NOISE_GLSL}
      void main() {
        vec2 uv = vUv * vec2(3.0, 1.0);
        float n = fbm(uv * 2.0 + vec2(uTime * 0.03, uTime * 0.008));
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x)
                   * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        float a = smoothstep(0.42, 0.85, n) * edge * uOpacity;
        gl_FragColor = vec4(0.5, 0.54, 0.6, a);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Grass blades                                                        */
/* ------------------------------------------------------------------ */

export function makeGrassMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: 0.4 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset;
      attribute float aSeed;
      uniform float uTime;
      uniform float uWind;
      varying float vShade;
      varying float vTip;
      void main() {
        vec3 p = position;
        float sway = sin(uTime * (1.1 + aSeed) + aOffset.x * 0.8 + aOffset.z) * (0.06 + uWind * 0.16);
        p.x += sway * uv.y * uv.y;
        p.z += sway * 0.6 * uv.y * uv.y;
        p += aOffset;
        vShade = 0.55 + aSeed * 0.45;
        vTip = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vShade;
      varying float vTip;
      void main() {
        vec3 base = vec3(0.05, 0.085, 0.045);
        vec3 tip = vec3(0.1, 0.16, 0.07);
        vec3 col = mix(base, tip, vTip) * vShade;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/** Instanced grass patch geometry: crossed blades scattered by `positions`. */
export function makeGrassGeometry(offsets: Float32Array): THREE.InstancedBufferGeometry {
  const blade = new THREE.PlaneGeometry(0.09, 0.42, 1, 2);
  blade.translate(0, 0.21, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = blade.index;
  geo.attributes.position = blade.attributes.position;
  geo.attributes.uv = blade.attributes.uv;
  const count = offsets.length / 3;
  geo.instanceCount = count;
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geo;
}

/* ------------------------------------------------------------------ */
/* Wind sway injection for tree canopies                               */
/* ------------------------------------------------------------------ */

export const windUniform = { value: 0.4 };
export const windTimeUniform = { value: 0 };

export function injectWindSway(material: THREE.Material, amplitude = 0.3): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindStrength = windUniform;
    shader.uniforms.uWindTime = windTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWindStrength;
         uniform float uWindTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float h = max(transformed.y, 0.0);
           float phase = uWindTime * 1.3 + transformed.x * 0.25 + transformed.z * 0.31;
           transformed.x += sin(phase) * uWindStrength * ${amplitude.toFixed(3)} * h * 0.18;
           transformed.z += cos(phase * 0.8) * uWindStrength * ${amplitude.toFixed(3)} * h * 0.12;
         }`
      );
  };
}
