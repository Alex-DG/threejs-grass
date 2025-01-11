uniform vec2 resolution;
uniform float time;
uniform sampler2DArray grassDiffuse;

// --- NEW: optional uniform for fade ---
uniform float fadeRadius;  // how far from center it should fully fade out
// uniform vec2 fadeCenter; // if you want a dynamic center, otherwise use (0,0)

varying vec3 vColour;
varying vec4 vGrassData;
varying vec3 vNormal;
varying vec3 vWorldPosition;

float inverseLerp(float v, float minValue, float maxValue) {
  return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(v, inMin, inMax);
  return mix(outMin, outMax, t);
}

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

float easeOut(float x, float t) {
	return 1.0 - pow(1.0 - x, t);
}

vec3 lambertLight(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 lightColour) {
  float wrap = 0.5;
  float dotNL = saturate((dot(normal, lightDir) + wrap) / (1.0 + wrap));
  vec3 lighting = vec3(dotNL);
  
  float backlight = saturate((dot(viewDir, -lightDir) + wrap) / (1.0 + wrap));
  vec3 scatter = vec3(pow(backlight, 2.0));

  lighting += scatter;

  return lighting * lightColour;  
}

vec3 hemiLight(vec3 normal, vec3 groundColour, vec3 skyColour) {
  return mix(groundColour, skyColour, 0.5 * normal.y + 0.5);
}

vec3 phongSpecular(vec3 normal, vec3 lightDir, vec3 viewDir) {
  float dotNL = saturate(dot(normal, lightDir));
  
  vec3 r = normalize(reflect(-lightDir, normal));
  float phongValue = max(0.0, dot(viewDir, r));
  phongValue = pow(phongValue, 32.0);

  vec3 specular = dotNL * vec3(phongValue);

  return specular;
}

void main() {
  float grassX = vGrassData.x;
  float grassY = vGrassData.y;
  float grassType = vGrassData.w;

  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // Sample base texture
  vec2 uv = vGrassData.zy;
  vec4 baseColour = texture2D(grassDiffuse, vec3(uv, grassType));

  // Example: If grassType == 1, it's a flower
  if (grassType == 1.0) {
    baseColour.rgb *= 1.0; // Brighter colors for flowers
    vec3 highlight = vec3(1.0, 0.0, 0.15); // Add reddish tint
    baseColour.rgb = mix(baseColour.rgb, highlight, 0.7);
  }

  // Discard if alpha in the texture is low (e.g. edge of grass texture)
  if (baseColour.a < 0.5) {
    discard;
  }

  // Hemisphere light
  vec3 c1 = vec3(1.0, 1.0, 0.75);
  vec3 c2 = vec3(0.05, 0.05, 0.25);
  vec3 ambientLighting = hemiLight(normal, c2, c1);

  // Directional light
  vec3 lightDir = normalize(vec3(-1.0, 0.5, 1.0));
  vec3 lightColour = vec3(1.0);
  vec3 diffuseLighting = lambertLight(normal, viewDir, lightDir, lightColour);

  // Specular
  vec3 specular = phongSpecular(normal, lightDir, viewDir);

  // Fake AO
  float ao = remap(pow(grassY, 2.0), 0.0, 1.0, 0.0625, 1.0);

  // Combine lighting
  vec3 lighting = diffuseLighting * 0.5 + ambientLighting * 0.5;

  // Final base color
  vec3 colour = baseColour.rgb * ambientLighting + specular * 0.25;
  colour *= ao * 1.25;

  // --- NEW: Radial fade based on distance from center in XZ-plane ---
  //    If your patch center is not (0,0), adjust accordingly or add a uniform for the center
  vec2 center = vec2(0.0, 0.0);
  float distFromCenter = length(vWorldPosition.xz - center);

  // fadeRadius: uniform to define how big the patch is before fully transparent
  // e.g., fade starts at 80% of fadeRadius, fully faded at fadeRadius
  float fadeFactor = 1.0 - smoothstep(0.7 * fadeRadius, fadeRadius, distFromCenter);

  // Combine texture alpha with fadeFactor
  float finalAlpha = baseColour.a * fadeFactor;

  // Optionally discard small alpha to avoid overdrawing
  if (finalAlpha < 0.01) discard;

  // Output final color (gamma-corrected) + alpha
  gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)), finalAlpha);
}
