import * as THREE from "three";

const canvas = document.getElementById("scene");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x050507, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0, 7);

// Group that holds the whole pulse object, so it can be offset/tilted as one.
const rig = new THREE.Group();
scene.add(rig);

// Simplex noise (Ashima Arts / Stefan Gustavson), used to displace the core.
const noiseGLSL = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

const uniforms = {
  uTime: { value: 0 },
  uPulse: { value: 0 },
  uHover: { value: 0 },
  uColorA: { value: new THREE.Color("#ff5a1f") },
  uColorB: { value: new THREE.Color("#6a3cff") },
};

// Core: a noise-displaced sphere that beats like a heart.
const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.35, 64),
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPulse;
      uniform float uHover;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vDisp;
      ${noiseGLSL}
      void main() {
        float n = snoise(normal * 1.6 + uTime * 0.35);
        float ridges = snoise(normal * 4.0 - uTime * 0.6) * 0.35;
        float disp = (n + ridges) * (0.16 + uHover * 0.12) + uPulse * 0.14;
        vDisp = disp;
        vec3 pos = position + normal * disp;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uPulse;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vDisp;
      void main() {
        float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.4);
        vec3 base = mix(uColorB, uColorA, smoothstep(-0.2, 0.25, vDisp));
        vec3 col = base * (0.18 + 0.5 * smoothstep(-0.1, 0.3, vDisp));
        col += fres * mix(uColorA, vec3(1.0, 0.85, 0.7), 0.4) * (1.1 + uPulse * 0.8);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
);
rig.add(core);

// Glow halo: back-facing, additive, slightly larger shell.
const halo = new THREE.Mesh(
  new THREE.SphereGeometry(1.75, 64, 64),
  new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform float uPulse;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float i = pow(max(dot(vNormal, vView), 0.0), 3.0);
        gl_FragColor = vec4(uColorA, i * (0.35 + uPulse * 0.45));
      }
    `,
  })
);
rig.add(halo);

// Shockwave rings that expand outward on every beat.
const RING_COUNT = 4;
const rings = [];
for (let i = 0; i < RING_COUNT; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.006, 8, 200),
    new THREE.MeshBasicMaterial({
      color: 0xffb08a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.rotation.x = Math.PI / 2.35;
  ring.userData.phase = i / RING_COUNT;
  rings.push(ring);
  rig.add(ring);
}

// Orbiting particle field.
const PARTICLES = 1800;
const positions = new Float32Array(PARTICLES * 3);
const seeds = new Float32Array(PARTICLES);
for (let i = 0; i < PARTICLES; i++) {
  const r = 2.1 + Math.pow(Math.random(), 2) * 3.2;
  const theta = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.5) * 0.9 * (r / 3);
  positions[i * 3] = Math.cos(theta) * r;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = Math.sin(theta) * r;
  seeds[i] = Math.random();
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
const particles = new THREE.Points(
  pGeo,
  new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uDpr: { value: renderer.getPixelRatio() } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPulse;
      uniform float uDpr;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        float r = length(position.xz);
        float ang = atan(position.z, position.x) + uTime * (0.25 / r) * (0.6 + aSeed);
        vec3 p = vec3(cos(ang) * r, position.y, sin(ang) * r);
        p *= 1.0 + uPulse * 0.05;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.0 + aSeed * 2.2) * uDpr * (6.0 / -mv.z);
        vAlpha = 0.25 + 0.6 * fract(aSeed * 7.0 + uTime * 0.2);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(1.0, 0.78, 0.62, a);
      }
    `,
  })
);
rig.add(particles);

// Interaction: pointer parallax and hover intensity.
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
let hoverTarget = 0;
window.addEventListener("pointermove", (e) => {
  pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  hoverTarget = Math.max(0, 1 - Math.hypot(pointer.tx - 0.3, pointer.ty + 0.1) * 1.4);
});

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Sit the object to the right on wide screens, centered and higher on narrow ones.
  const wide = w / h > 1.1;
  rig.position.set(wide ? 1.6 : 0, wide ? 0.25 : 1.5, 0);
  rig.scale.setScalar(wide ? 1 : 0.55);
}
window.addEventListener("resize", () => {
  layout();
  if (reducedMotion) renderer.render(scene, camera);
});
layout();

// Heartbeat envelope: two quick beats, then rest ("lub-dub").
function heartbeat(t) {
  const period = 1.6;
  const p = (t % period) / period;
  const beat = (center, width) => Math.exp(-Math.pow((p - center) / width, 2));
  return beat(0.08, 0.04) + 0.6 * beat(0.24, 0.05);
}

const clock = new THREE.Clock();
function frame() {
  const t = reducedMotion ? 2 : clock.getElapsedTime();
  uniforms.uTime.value = t;
  uniforms.uPulse.value = reducedMotion ? 0.3 : heartbeat(t);

  pointer.x += (pointer.tx - pointer.x) * 0.05;
  pointer.y += (pointer.ty - pointer.y) * 0.05;
  uniforms.uHover.value += (hoverTarget - uniforms.uHover.value) * 0.05;

  rig.rotation.y = pointer.x * 0.35;
  rig.rotation.x = pointer.y * 0.2;
  core.rotation.y = t * 0.12;
  particles.rotation.z = Math.sin(t * 0.1) * 0.08;

  for (const ring of rings) {
    const k = (t * 0.45 + ring.userData.phase) % 1;
    ring.scale.setScalar(1 + k * 1.6);
    ring.material.opacity = (1 - k) * 0.55 * (reducedMotion ? 0.5 : 1);
  }

  renderer.render(scene, camera);
  if (!reducedMotion) requestAnimationFrame(frame);
}
frame();
