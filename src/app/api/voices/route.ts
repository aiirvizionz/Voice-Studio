import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({error: "Falta OPENAI_API_KEY en .env.local. Configura tu proyecto antes de crear una voz."}, {status: 503});
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({error: "JSON no válido"}, {status: 400}); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const script = typeof body.script_hint === "string" ? body.script_hint.trim() : "";
  if (!name || name.length > 120 || prompt.length < 35 || prompt.length > 2000 || script.length > 2000) {
    return NextResponse.json({error: "Revisa el nombre (1–120 caracteres), la descripción (35–2000) y el ejemplo (máximo 2000)."}, {status: 400});
  }
  try {
    const response = await fetch("https://api.openai.com/v1/audio/voices", {
      method: "POST",
      headers: {Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json"},
      body: JSON.stringify({type: "prompt", name, prompt, model: "auto", ...(script.length >= 25 ? {script_hint: script} : {})}),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({error: data?.error?.message || `OpenAI devolvió ${response.status}`}, {status: response.status});
    if (typeof data?.id !== "string") return NextResponse.json({error: "OpenAI no devolvió un identificador de voz."}, {status: 502});
    return NextResponse.json({id: data.id, name: data.name || name, prompt: data.prompt || prompt, created_at: data.created_at});
  } catch (err) {
    return NextResponse.json({error: err instanceof Error ? err.message : "Error de conexión con OpenAI"}, {status: 502});
  }
}
