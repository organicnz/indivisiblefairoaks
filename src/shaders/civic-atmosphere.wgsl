struct Params {
  time: f32,
  width: f32,
  height: f32,
  mouseX: f32,
  mouseY: f32,
  intensity: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

// Smooth hash function for procedural noise
fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 2D noise
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash21(i + vec2f(0.0, 0.0));
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractional Brownian Motion for fluid waves
fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var shift = vec2f(100.0);
  var pos = p;
  for (var i = 0; i < 4; i++) {
    v += a * noise(pos);
    pos = pos * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.width / max(params.height, 1.0);
  let p = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);

  let t = params.time * 0.18;

  // Normalized mouse coordinate in aspect-corrected space
  let mouseP = vec2f((params.mouseX - 0.5) * aspect, params.mouseY - 0.5);
  let mouseDist = length(p - mouseP);
  let mouseGlow = exp(-mouseDist * 3.5) * 0.45 * params.intensity;

  // Layer 1: Deep civic ocean undulation
  let q = vec2f(
    fbm(p * 1.5 + vec2f(t * 0.4, t * 0.2)),
    fbm(p * 1.5 + vec2f(-t * 0.3, t * 0.5))
  );

  // Layer 2: Radiant democracy aurora ribbons
  let r = vec2f(
    fbm(p * 2.0 + q * 1.2 + vec2f(t * 0.6, -t * 0.3)),
    fbm(p * 2.0 + q * 1.2 + vec2f(-t * 0.4, t * 0.7))
  );

  let wave = fbm(p * 2.5 + r * 1.5);

  // Color palette: Civic Slate -> Sapphire -> Cyan Aurora -> Golden Hope
  let baseDark = vec3f(0.02, 0.05, 0.12);     // Deep midnight slate
  let sapphire = vec3f(0.08, 0.22, 0.55);     // Civic sapphire
  let cyanGlow = vec3f(0.15, 0.65, 0.95);     // Electric democratic cyan
  let amberGold = vec3f(0.95, 0.76, 0.25);    // Sunlight / hope amber

  // Color mixing based on procedural flow
  var col = mix(baseDark, sapphire, smoothstep(0.1, 0.65, wave));
  col = mix(col, cyanGlow, smoothstep(0.45, 0.85, wave) * 0.7);
  col = mix(col, amberGold, pow(smoothstep(0.65, 0.95, wave), 2.5) * 0.5);

  // Add mouse ripple & illumination
  col += cyanGlow * mouseGlow;
  col += amberGold * (mouseGlow * 0.35);

  // Procedural subtle stars / civic lights
  let starGrid = uv * vec2f(60.0 * aspect, 60.0);
  let starCell = floor(starGrid);
  let starRandom = hash21(starCell);
  if (starRandom > 0.978) {
    let starPos = fract(starGrid) - 0.5;
    let starDist = length(starPos);
    let pulse = sin(params.time * 2.5 + starRandom * 6.28) * 0.5 + 0.5;
    let starLight = exp(-starDist * 16.0) * pulse * 0.75;
    col += mix(cyanGlow, amberGold, starRandom) * starLight;
  }

  // Vignette towards edges and bottom to allow text readability
  let vig = (1.0 - length(uv - 0.5) * 0.7) * (1.0 - uv.y * 0.3);
  col *= max(vig, 0.25);

  return vec4f(col, 1.0);
}
