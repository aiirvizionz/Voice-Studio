import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({error: "Falta OPENAI_API_KEY en .env.local."}, {status: 503});
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({error: "JSON no válido"}, {status: 400}); }
  const sdp = typeof body.sdp === "string" ? body.sdp : "";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 2000) : "";
  if (!sdp.startsWith("v=0") || sdp.length > 100_000 || !/^voice_[\w-]{3,}$/.test(voiceId)) {
    return NextResponse.json({error: "SDP o identificador de voz no válido."}, {status: 400});
  }
  const instructions = [
    "Eres una voz original creada para un laboratorio de pruebas de voz. Habla en español de forma natural, clara y expresiva.",
    "Cuando el usuario pida un ejemplo de narración, puedes intentar leer su guion con fidelidad; si no puedes leerlo literalmente, no afirmes que lo hiciste.",
    "Responde brevemente y sin presentaciones largas. No imites personas reales.",
    `Descripción vocal: ${prompt}`,
  ].join("\n");
  try {
    const response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json"},
      body: JSON.stringify({session: {model: "gpt-live-1", instructions, audio: {output: {voice: {id: voiceId}}}}, transport: {type: "webrtc", sdp}}),
      signal: AbortSignal.timeout(45000), cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({error: data?.error?.message || `Error de sesión: ${response.status}`}, {status: response.status});
    if (!data?.transport?.sdp) return NextResponse.json({error: "No se recibió respuesta SDP de OpenAI."}, {status: 502});
    return NextResponse.json({sdp: data.transport.sdp, sessionId: data.session?.id});
  } catch (err) {
    return NextResponse.json({error: err instanceof Error ? err.message : "No se pudo establecer la sesión."}, {status: 502});
  }
}
