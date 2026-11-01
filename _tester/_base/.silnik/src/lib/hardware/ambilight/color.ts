export interface TVColor {
  hue: number;
  saturation: number;
  brightness: number;
}
export interface LightingPayload {
  on?: { on: boolean };
  dimming?: { brightness: number };
  color_temperature?: { mirek: number };
  color?: { xy: { x: number; y: number } };
  dynamics?: { duration: number };
}
const clamp = (n: number, max = 255) => Math.max(0, Math.min(max, n));

export function lightingToColor(
  payload: LightingPayload,
  previous: TVColor = { hue: 25, saturation: 170, brightness: 100 }
): TVColor {
  let rgb: number[] | undefined;
  if (payload.color_temperature) {
    const t = 1000000 / payload.color_temperature.mirek / 100;
    rgb = [
      t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592),
      t <= 66
        ? 99.4708025861 * Math.log(t) - 161.1195681661
        : 288.1221695283 * Math.pow(t - 60, -0.0755148492),
      t >= 66
        ? 255
        : t <= 19
          ? 0
          : 138.5177312231 * Math.log(t - 10) - 305.0447927307,
    ].map((n) => clamp(n) / 255);
  } else if (payload.color) {
    const { x, y } = payload.color.xy;
    const X = x / Math.max(y, 0.001),
      Z = (1 - x - y) / Math.max(y, 0.001);
    const linear = [
      1.656492 * X - 0.354851 - 0.255038 * Z,
      -0.707196 * X + 1.655397 + 0.036152 * Z,
      0.051713 * X - 0.121364 + 1.01153 * Z,
    ];
    const peak = Math.max(1, ...linear);
    rgb = linear.map((v) => {
      const n = Math.max(0, v / peak);
      return n <= 0.0031308 ? 12.92 * n : 1.055 * Math.pow(n, 1 / 2.4) - 0.055;
    });
  }
  const result = { ...previous };
  if (rgb) {
    const [r, g, b] = rgb,
      max = Math.max(...rgb),
      min = Math.min(...rgb),
      d = max - min;
    const h =
      d === 0
        ? 0
        : max === r
          ? ((g - b) / d) % 6
          : max === g
            ? (b - r) / d + 2
            : (r - g) / d + 4;
    result.hue = Math.round((((h * 60 + 360) % 360) * 255) / 360);
    result.saturation = Math.round(max === 0 ? 0 : (d / max) * 255);
  }
  if (payload.dimming)
    result.brightness = Math.round(
      (clamp(payload.dimming.brightness, 100) * 255) / 100
    );
  if (payload.on?.on === false) result.brightness = 0;
  return result;
}
