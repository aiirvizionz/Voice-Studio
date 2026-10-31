export type VocalStyle = {
  accent: string;
  presentation: string;
  pitch: number;
  pace: number;
  texture: number;
  expressiveness: number;
  detail: string;
};
export type SavedVoice = {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  style?: VocalStyle;
};
export type SavedScript = { id: string; name: string; content: string; updatedAt: string };
export const sampleText = "Hay algo extraordinario en la forma en que una voz puede transmitir una idea. No se trata solo de pronunciar palabras, sino de darles intención, ritmo y emoción. Bienvenido a una nueva forma de crear con inteligencia artificial.";
export const presets = [
  {label: "Narrador cálido", tone: "Cercano y sereno", detail: "Sonido cálido y redondo, respiración natural, sin cadencia de locutor comercial.", icon: "heart"},
  {label: "Podcast dinámico", tone: "Ágil y expresivo", detail: "Articulación clara y ágil, ritmo natural de conversación, entusiasmo contenido.", icon: "radio"},
  {label: "Meditación", tone: "Calmado y suave", detail: "Timbre suave, pausas generosas y presencia tranquila, sin sonar susurrado.", icon: "moon"},
];
const pitchLabels = ["muy grave", "grave", "medio", "agudo", "muy agudo"];
const paceLabels = ["muy pausado", "pausado", "natural", "rápido", "muy rápido"];
const textureLabels = ["aterciopelado", "suave", "claro", "ligeramente áspero", "áspero"];
const expressionLabels = ["sobrio", "contenido", "equilibrado", "expresivo", "muy expresivo"];
export function createVoicePrompt(style: VocalStyle): string {
  const pick = (items: string[], n: number) => items[Math.max(0, Math.min(4, Math.round(n) - 1))];
  const extra = style.detail.trim();
  return [
    `Una voz adulta original, de presentación ${style.presentation}, con acento ${style.accent}.`,
    `Registro ${pick(pitchLabels, style.pitch)}, ritmo ${pick(paceLabels, style.pace)}, textura ${pick(textureLabels, style.texture)} y entonación ${pick(expressionLabels, style.expressiveness)}.`,
    "Que suene como una persona real hablando con alguien cercano: respiración natural, dicción precisa y variación orgánica de las frases. Evita una voz robótica, de caricatura o excesivamente publicitaria.",
    extra ? `Características adicionales: ${extra}` : "",
  ].filter(Boolean).join(" ");
}
export const defaultStyle: VocalStyle = {
  accent: "mexicano contemporáneo", presentation: "masculina", pitch: 3, pace: 3,
  texture: 2, expressiveness: 4, detail: "Cálida, conversacional y con una energía relajada, ideal para narrar contenido tecnológico.",
};
