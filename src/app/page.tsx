"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines, AudioWaveform, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Copy,
  Download, FileAudio, FileText, FolderOpen, Headphones, Heart, Library,
  Mic2, Moon, Pause, Play, Plus, Radio, Save, Settings2,
  SlidersHorizontal, Sparkles, Square, WandSparkles, X, Zap
} from "lucide-react";
import { createVoicePrompt, defaultStyle, presets, sampleText, type SavedScript, type SavedVoice, type VocalStyle } from "@/lib/voice";
import { readLocal, writeLocal } from "@/lib/storage";

type Section = "studio" | "voices" | "guide";
type LiveState = "idle" | "connecting" | "live";
const keys = {voices: "voice-studio-voices-v1", scripts: "voice-studio-scripts-v1", draft: "voice-studio-draft-v1", selected: "voice-studio-selected-v1", style: "voice-studio-style-v1"};
const today = () => new Date().toISOString();
const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-MX", {day:"numeric",month:"short",year:"numeric"});
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
function safeMessage(e: unknown) {return e instanceof Error ? e.message : "Ocurrió un error inesperado.";}
function SliderControl({label, value, onChange, low, high}: {label: string; value: number; onChange:(n:number)=>void;low:string;high:string}) {
  return <div className="slider-control">
    <div className="slider-heading"><label>{label}</label><span>{["Muy bajo","Bajo","Medio","Alto","Muy alto"][value-1]}</span></div>
    <input type="range" min="1" max="5" step="1" value={value} onChange={e=>onChange(Number(e.target.value))} style={{"--slider-value": `${(value-1)*25}%`} as React.CSSProperties}/>
    <div className="slider-labels"><span>{low}</span><span>{high}</span></div>
  </div>;
}
function MiniWave({active = false}: {active?: boolean}) {
  return <div className={`mini-wave ${active ? "wave-active" : ""}`} aria-hidden="true">
    {Array.from({length: 34},(_,i)=><span key={i} style={{height: `${7+Math.abs(Math.sin(i*1.6)*Math.cos(i*.31))*29}px`, animationDelay:`-${i*0.047}s`}}/>)}
  </div>;
}
export default function Page() {
  const [section, setSection] = useState<Section>("studio");
  const [voiceName, setVoiceName] = useState("Mi primera voz");
  const [script, setScript] = useState(sampleText);
  const [scriptName, setScriptName] = useState("Guion de bienvenida");
  const [style, setStyle] = useState<VocalStyle>(defaultStyle);
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState<{text:string; kind:"ok"|"error"|"info"}|null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [connectionStep, setConnectionStep] = useState("Vista previa conversacional");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string|null>(null);
  const [audioName, setAudioName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection|null>(null);
  const dcRef = useRef<RTCDataChannel|null>(null);
  const inputRef = useRef<MediaStream|null>(null);
  const recorderRef = useRef<MediaRecorder|null>(null);
  const remoteStreamRef = useRef<MediaStream|null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const failedSessionRef = useRef(false);
  const liveStateRef = useRef<LiveState>("idle");

  const selectedVoice = useMemo(()=>voices.find(v=>v.id===selectedId),[voices,selectedId]);
  const prompt = useMemo(()=>createVoicePrompt(style),[style]);
  const words = useMemo(()=>script.trim().split(/\s+/).filter(Boolean).length,[script]);
  function inform(text: string, kind: "ok"|"error"|"info"="info") {setNotice({text,kind});}
  function editStyle<K extends keyof VocalStyle>(key: K, value: VocalStyle[K]) { setStyle(s=>({...s,[key]:value})); }

  useEffect(()=>{
    setVoices(readLocal(keys.voices, [] as SavedVoice[]));
    setScripts(readLocal(keys.scripts, [] as SavedScript[]));
    setScript(readLocal(keys.draft, sampleText));
    setSelectedId(readLocal(keys.selected, ""));
    setStyle(readLocal(keys.style, defaultStyle));
    setLoaded(true);
  },[]);
  useEffect(()=>{if (loaded) {writeLocal(keys.voices, voices);writeLocal(keys.scripts, scripts);writeLocal(keys.draft, script);writeLocal(keys.selected, selectedId);writeLocal(keys.style, style);}},[loaded,voices,scripts,script,selectedId,style]);
  useEffect(()=>{return ()=>{pcRef.current?.close();inputRef.current?.getTracks().forEach(t=>t.stop());};},[]);
  useEffect(()=>{return ()=>{if(audioUrl) URL.revokeObjectURL(audioUrl);};},[audioUrl]);

  const saveScript = useCallback(()=>{
    if (!script.trim()) {inform("Escribe un guion antes de guardarlo.","error");return;}
    const row: SavedScript = {id:makeId(),name:scriptName.trim()||"Sin título",content:script,updatedAt:today()};
    setScripts(old=>[row,...old].slice(0,50)); inform("Guion guardado en este navegador.","ok");
  },[script,scriptName]);
  useEffect(()=>{
    const onKey = (e: KeyboardEvent)=>{if ((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s") {e.preventDefault();saveScript();}};
    window.addEventListener("keydown",onKey); return ()=>window.removeEventListener("keydown",onKey);
  },[saveScript]);

  async function createVoice() {
    if (liveStateRef.current!=="idle") {inform("Finaliza la sesión Live antes de cambiar de voz.","error");return;}
    if (!voiceName.trim()) {inform("Asigna un nombre a la voz.","error");return;}
    setIsCreating(true);setNotice(null);
    try {
      const response = await fetch("/api/voices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:voiceName.trim(),prompt,script_hint:script.slice(0,2000)})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible crear la voz.");
      const voice:SavedVoice = {id:data.id,name:data.name||voiceName.trim(),prompt:data.prompt||prompt,createdAt:today(),style:{...style}};
      setVoices(old=>[voice,...old.filter(v=>v.id!==voice.id)]);setSelectedId(voice.id);
      inform("Voz creada con OpenAI. Ya puedes probarla en GPT-Live.","ok");
    } catch (e) {inform(safeMessage(e),"error");}
    finally {setIsCreating(false);}
  }

  function stopLive() {
    // Keep the recorded audio until MediaRecorder has emitted its final chunks.
    liveStateRef.current = "idle";
    setLiveState("idle");
    setConnectionStep("Vista previa conversacional");
    if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
    startupTimerRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* recorder already closed */ }
    }
    const dc = dcRef.current;
    dcRef.current = null;
    if (dc && dc.readyState !== "closed") dc.close();
    pcRef.current?.close();
    pcRef.current = null;
    inputRef.current?.getTracks().forEach(track => track.stop());
    inputRef.current = null;
    remoteStreamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }

  function failLive(message: string) {
    if (liveStateRef.current === "idle") return;
    failedSessionRef.current = true;
    stopLive();
    inform(message, "error");
  }

  function startRecording(stream: MediaStream) {
    if (recorderRef.current) return;
    if (typeof MediaRecorder === "undefined") {
      inform("Tu navegador no admite la grabación de audio. Prueba Chrome o Edge.", "info");
      return;
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t));
    try {
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const pieces: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) pieces.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(pieces, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          if (!failedSessionRef.current) inform("La sesión terminó sin audio generado. Habla con GPT-Live y espera una respuesta antes de detenerla.", "info");
          return;
        }
        setAudioUrl(URL.createObjectURL(blob));
        setAudioName('voice-studio-' + new Date().toISOString().slice(0, 19).replaceAll(":", "-") + (recorder.mimeType.includes("mp4") ? ".m4a" : ".webm"));
        if (!failedSessionRef.current) inform("Grabación terminada. Puedes escucharla y descargarla.", "ok");
      };
      recorder.start(500);
    } catch {
      inform("La sesión está conectada, pero tu navegador no admite grabar este audio.", "info");
    }
  }

  async function startLive() {
    if (liveStateRef.current !== "idle") return;
    if (!selectedVoice) { inform("Primero crea o selecciona una voz guardada.", "error"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { inform("Necesitas HTTPS o localhost para usar el micrófono.", "error"); return; }
    failedSessionRef.current = false;
    liveStateRef.current = "connecting";
    setLiveState("connecting");
    setConnectionStep("Solicitando permiso del micrófono...");
    setLiveTranscript("");
    setLiveSeconds(0);
    setAudioUrl(null);
    setNotice(null);
    let peer: RTCPeerConnection | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      // The user may have cancelled while the browser permission dialog was open.
      if (liveStateRef.current === "idle") {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      inputRef.current = stream;
      peer = new RTCPeerConnection();
      const connection = peer;
      pcRef.current = connection;
      const isCurrent = () => pcRef.current === connection && liveStateRef.current !== "idle";
      const streamForRecording = () => {
        if (remoteStreamRef.current && liveStateRef.current === "live") startRecording(remoteStreamRef.current);
      };

      connection.ontrack = e => {
        if (e.track.kind !== "audio" || !isCurrent()) return;
        const remote = e.streams[0] || new MediaStream([e.track]);
        remoteStreamRef.current = remote;
        if (audioRef.current) {
          audioRef.current.srcObject = remote;
          void audioRef.current.play().catch(() => {
            if (isCurrent()) inform("Tu navegador bloqueó la reproducción. Habilita el sonido para este sitio.", "info");
          });
        }
        // Do not start a recorder during SDP negotiation: the track may not be active yet.
        streamForRecording();
      };
      connection.onconnectionstatechange = () => {
        if (!isCurrent()) return;
        if (connection.connectionState === "failed") {
          failLive("WebRTC no pudo establecer la conexión. Revisa tu red (VPN, firewall o WebRTC/UDP) e intenta de nuevo.");
        }
      };
      stream.getAudioTracks().forEach(track => connection.addTrack(track, stream));
      const channel = connection.createDataChannel("oai-events");
      dcRef.current = channel;
      channel.onclose = () => {
        if (isCurrent()) failLive("El canal de GPT-Live se cerró inesperadamente. La grabación se detuvo por pérdida de conexión.");
      };
      channel.onerror = () => {
        if (isCurrent()) failLive("Error en el canal de datos de GPT-Live. Comprueba tu conexión de red.");
      };
      channel.onmessage = e => {
        if (!isCurrent()) return;
        try {
          const event = JSON.parse(e.data);
          if (event.type === "session.started") {
            if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
            startupTimerRef.current = null;
            liveStateRef.current = "live";
            setLiveState("live");
            setConnectionStep("Micrófono activo");
            streamForRecording();
            inform("GPT-Live conectado. Habla y espera su respuesta; el audio se guardará al detener la sesión.", "ok");
          } else if (event.type === "session.output_transcript.delta") {
            setLiveTranscript(s => (s + String(event.delta || "")).slice(-10000));
          } else if (event.type === "session.usage.updated") {
            setLiveSeconds(event.usage?.seconds || 0);
          } else if (event.type === "error") {
            failLive(event.error?.message || "GPT-Live reportó un error en la sesión.");
          } else if (event.type === "session.closed") {
            const reason = typeof event.reason === "string" ? event.reason : "desconocida";
            failedSessionRef.current = reason !== "close_requested";
            stopLive();
            inform(reason === "close_requested" ? "Sesión finalizada." : "GPT-Live cerró la sesión (motivo: " + reason + "). Intenta de nuevo.", reason === "close_requested" ? "info" : "error");
          }
        } catch (error) {
          // Do not swallow actual session errors; only ignore malformed JSON events.
          if (error instanceof SyntaxError) return;
          if (isCurrent()) failLive("Error procesando la sesión Live.");
        }
      };

      setConnectionStep("Negociando audio y red...");
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      // This API exchanges a complete SDP offer; an incomplete ICE gathering can
      // cause an apparently successful start followed by an immediate disconnect.
      if (connection.iceGatheringState !== "complete") {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            connection.removeEventListener("icegatheringstatechange", onState);
            reject(new Error("No se completó ICE. Revisa la conexión, firewall o VPN."));
          }, 15000);
          function onState() {
            if (connection.iceGatheringState !== "complete") return;
            clearTimeout(timeout);
            connection.removeEventListener("icegatheringstatechange", onState);
            resolve();
          }
          connection.addEventListener("icegatheringstatechange", onState);
        });
      }
      if (!isCurrent()) return;
      setConnectionStep("Creando sesión GPT-Live...");
      startupTimerRef.current = setTimeout(() => {
        if (isCurrent() && liveStateRef.current === "connecting") {
          failLive("No llegó la confirmación de GPT-Live en 60 segundos. Revisa la conexión y vuelve a intentar.");
        }
      }, 60000);
      const response = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: connection.localDescription?.sdp, voiceId: selectedVoice.id, prompt: selectedVoice.prompt })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "No se pudo iniciar GPT-Live (HTTP " + response.status + ").");
      }
      if (!isCurrent()) return;
      if (typeof data.sdp !== "string") throw new Error("OpenAI no devolvió una respuesta WebRTC válida.");
      setConnectionStep("Esperando confirmación de GPT-Live...");
      await connection.setRemoteDescription({ type: "answer", sdp: data.sdp });
      // "session.started" is the source of truth for the connected state.
    } catch (error) {
      if (liveStateRef.current !== "idle") {
        const name = error instanceof DOMException ? error.name : "";
        const description = name === "NotAllowedError" ? "El micrófono está bloqueado. Permítelo en los ajustes del navegador." :
          name === "NotFoundError" ? "No se encontró un micrófono disponible." :
          error instanceof Error ? error.message : "No se pudo establecer la sesión Live.";
        failLive(description);
      }
    }
  }

  function sendScript() {
    if (dcRef.current?.readyState!=="open" || liveStateRef.current!=="live") {inform("Inicia primero una sesión Live.","error");return;}
    if(!script.trim()) {inform("Escribe un texto para enviar.","error");return;}
    const excerpt=script.trim().slice(0,900);
    dcRef.current.send(JSON.stringify({type:"session.commentary.append",event_id:`script_${Date.now()}`,delegation_id:null,content:`Texto propuesto para una prueba de narración: ${excerpt}`}));
    inform(script.length>900?"Se envió un fragmento de 900 caracteres. Pide por voz que lo lea; GPT-Live puede parafrasearlo.":"Guion enviado como contexto. Pide por voz que lo lea; GPT-Live puede parafrasearlo.","info");
  }
  function chooseVoice(v:SavedVoice){if(liveStateRef.current!=="idle") {inform("Termina la sesión antes de seleccionar otra voz.","error");return;}setSelectedId(v.id);setSection("studio");inform(`Voz «${v.name}» seleccionada.`,"ok");}
  function clearVoice(id:string){if(liveStateRef.current!=="idle") {inform("Termina la sesión antes de borrar una voz.","error");return;}setVoices(old=>old.filter(v=>v.id!==id));if(selectedId===id)setSelectedId("");inform("Voz eliminada de la biblioteca local. No se borró de tu organización OpenAI.","info");}
  function downloadAudio(){if(!audioUrl)return;const a=document.createElement("a");a.href=audioUrl;a.download=audioName||"voz.webm";a.click();}
  const NavItem = ({tab,icon,label,count}:{tab:Section;icon:React.ReactNode;label:string;count?:number})=><button type="button" className={`nav-item ${section===tab?"selected":""}`} onClick={()=>setSection(tab)}>{icon}<span>{label}</span>{typeof count==="number"&&<span className="nav-count">{count}</span>}</button>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><AudioWaveform size={23} strokeWidth={2.2}/></div><div><strong>voice<span>studio</span></strong><small>AI CREATIVE WORKSPACE</small></div></div>
      <div className="workspace-pill"><div className="workspace-avatar">V</div><div><strong>Mi espacio</strong><span>Proyecto personal</span></div><ChevronDown size={15}/></div>
      <div className="nav-label">ESPACIO DE TRABAJO</div>
      <nav className="main-nav" aria-label="Navegación principal">
        <NavItem tab="studio" icon={<SlidersHorizontal size={18}/>} label="Estudio de voz"/>
        <NavItem tab="voices" icon={<Library size={18}/>} label="Mis voces" count={voices.length}/>
        <NavItem tab="guide" icon={<BookOpen size={18}/>} label="Cómo funciona"/>
      </nav>
      <div className="sidebar-spacer"/>
      <div className="side-card"><div className="side-card-icon"><Sparkles size={18}/></div><strong>Crea algo único</strong><p>Diseña una voz con personalidad, tono y acento propios.</p><button type="button" onClick={()=>{setSection("studio");document.getElementById("voice-name")?.focus();}}>Empezar a crear <span>↗</span></button></div>
      <div className="sidebar-bottom"><div className="online-dot"/> GPT-Live 1 · OpenAI API</div>
    </aside>
    <div className="main-wrapper">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="separator">/</span><b>{section==="studio"?"Estudio de voz":section==="voices"?"Mis voces":"Cómo funciona"}</b></div><div className="topbar-actions"><div className="ai-tag"><span/> POWERED BY OPENAI</div><a href="https://platform.openai.com/api-keys" rel="noreferrer" target="_blank" className="top-icon" title="Abrir OpenAI Platform"><Settings2 size={18}/></a></div></header>
      {notice&&<div className={`notice notice-${notice.kind}`} role="status"><span>{notice.kind==="ok"?<Check size={16}/>:notice.kind==="error"?<CircleHelp size={16}/>:<Sparkles size={16}/>}</span><p>{notice.text}</p><button type="button" aria-label="Cerrar aviso" onClick={()=>setNotice(null)}><X size={16}/></button></div>}
      <main className="content">
        {section==="studio"&&<>
          <div className="page-heading"><div><div className="eyebrow"><span className="pulse-icon"/> TU ESTUDIO CREATIVO</div><h1>Da vida a tus palabras<span>.</span></h1><p>Diseña voces únicas con inteligencia artificial y explora su sonido con GPT-Live.</p></div><div className="heading-stat"><div><AudioLines size={19}/></div><span><strong>{voices.length}</strong><small>Voces creadas</small></span></div></div>
          <div className="workspace-grid">
            <section className="editor-panel panel">
              <div className="panel-head"><div className="panel-title"><span className="icon-square lavender"><FileText size={19}/></span><div><h2>Editor de guion</h2><p>El texto que quieres convertir en voz</p></div></div><button className="soft-button" type="button" onClick={saveScript}><Save size={15}/> Guardar</button></div>
              <div className="name-line"><span>PROYECTO</span><input aria-label="Nombre del guion" value={scriptName} maxLength={80} onChange={e=>setScriptName(e.target.value)}/></div>
              <textarea className="script-editor" spellCheck="true" aria-label="Guion a narrar" value={script} onChange={e=>setScript(e.target.value)} placeholder="Escribe aquí tu guion, historia o narración..." />
              <div className="editor-footer"><div className="editor-metrics"><span><FileText size={14}/>{words} palabras</span><span><Clock3 size={14}/> ~{Math.max(1,Math.ceil(words/145))} min de lectura</span></div><button type="button" className="text-action" onClick={()=>setScript(sampleText)}><Sparkles size={15}/> Texto de ejemplo</button></div>
              <div className="editor-bottom"><div className="tip-bubble"><Sparkles size={16}/><span>Tip: prueba textos de al menos 2 oraciones para notar la naturalidad y la entonación.</span></div></div>
            </section>
            <section className="voice-panel panel">
              <div className="panel-head"><div className="panel-title"><span className="icon-square purple"><WandSparkles size={19}/></span><div><h2>Diseñador de voz</h2><p>Personaliza cada detalle de tu sonido</p></div></div><div className="pill-mini">PROMPT-TO-VOICE</div></div>
              <label className="field-label" htmlFor="voice-name">NOMBRE DE TU VOZ</label>
              <input className="text-input" id="voice-name" value={voiceName} maxLength={120} onChange={e=>setVoiceName(e.target.value)} placeholder="Por ejemplo, Narrador Mexicano"/>
              <div className="two-fields"><div><label className="field-label" htmlFor="accent">ACENTO</label><div className="select-wrap"><select id="accent" value={style.accent} onChange={e=>editStyle("accent",e.target.value)}><option value="mexicano contemporáneo">Español · México</option><option value="español neutro latinoamericano">Español · Latam</option><option value="colombiano">Español · Colombia</option><option value="rioplatense argentino">Español · Argentina</option><option value="castellano de España">Español · España</option><option value="General American English">Inglés · EE. UU.</option><option value="británico contemporáneo">Inglés · Reino Unido</option></select><ChevronDown size={15}/></div></div>
              <div><label className="field-label" htmlFor="presentation">PRESENTACIÓN</label><div className="select-wrap"><select id="presentation" value={style.presentation} onChange={e=>editStyle("presentation",e.target.value)}><option value="masculina">Masculina</option><option value="femenina">Femenina</option><option value="andrógina">Andrógina</option></select><ChevronDown size={15}/></div></div></div>
              <div className="slider-grid"><SliderControl label="Tono de voz" value={style.pitch} onChange={n=>editStyle("pitch",n)} low="Grave" high="Agudo"/><SliderControl label="Velocidad" value={style.pace} onChange={n=>editStyle("pace",n)} low="Lenta" high="Rápida"/><SliderControl label="Textura vocal" value={style.texture} onChange={n=>editStyle("texture",n)} low="Suave" high="Áspera"/><SliderControl label="Expresividad" value={style.expressiveness} onChange={n=>editStyle("expressiveness",n)} low="Serena" high="Dinámica"/></div>
              <label className="field-label" htmlFor="voice-detail">INSTRUCCIONES ADICIONALES</label>
              <textarea id="voice-detail" className="detail-editor" value={style.detail} onChange={e=>editStyle("detail",e.target.value)} maxLength={500} placeholder="¿Cómo te imaginas que suena?" />
              <details className="prompt-details"><summary><FileText size={15}/> Ver descripción que recibirá la IA <ChevronDown size={15}/></summary><p>{prompt}</p><button type="button" onClick={()=>{void navigator.clipboard.writeText(prompt);inform("Descripción copiada.","ok");}}><Copy size={14}/> Copiar prompt</button></details>
              <button className="primary-button" type="button" onClick={createVoice} disabled={isCreating||liveState!=="idle"}>{isCreating?<><div className="spinner"/> Creando voz...</>:<><Sparkles size={18}/> Crear mi voz <span>→</span></>}</button>
              <div className="voice-fineprint"><Check size={13}/> Crear la voz no genera audio ni tiene costo de creación.</div>
            </section>
          </div>
          <div className="lower-grid">
            <section className="playback-panel panel"><div className="section-title"><div className="panel-title"><span className="icon-square cyan"><Headphones size={19}/></span><div><h2>Laboratorio Live</h2><p>Escucha tu voz con GPT-Live en tiempo real</p></div></div><span className={`live-indicator ${liveState==="live"?"on":""}`}><span/>{liveState==="live"?"EN VIVO":liveState==="connecting"?"CONECTANDO":"EN ESPERA"}</span></div>
              <div className="playback-body"><div className="player-art"><div className="player-halo"><AudioWaveform size={24}/></div></div><div className="player-center"><strong>{selectedVoice?.name??"Tu próxima voz"}</strong><span>{selectedVoice?"Voz personalizada · GPT-Live 1":"Crea una voz para empezar a escucharla"}</span><MiniWave active={liveState==="live"}/></div><div className="player-buttons">{liveState==="idle"?<button type="button" className="play-button" disabled={!selectedVoice} onClick={startLive} aria-label="Iniciar sesión Live"><Play size={21} fill="currentColor"/></button>:<button type="button" className="play-button stop-button" onClick={stopLive} aria-label="Finalizar sesión Live"><Square size={18} fill="currentColor"/></button>}</div></div>
              <div className="player-footer"><span><Mic2 size={15}/> {liveState==="live"?"Micrófono activo":liveState==="connecting"?connectionStep:"Vista previa conversacional"}</span><button type="button" disabled={liveState!=="live"} className="outline-button" onClick={sendScript}><FileText size={15}/> Enviar guion a Live</button></div>
              {liveTranscript&&<div className="transcript"><span>LO QUE DIJO GPT-LIVE</span><p>{liveTranscript}</p></div>}
              {liveSeconds>0&&<div className="session-usage">Duración facturable reportada: {Math.round(liveSeconds)} s</div>}
              {audioUrl&&<div className="saved-audio"><div><FileAudio size={17}/><strong>Prueba de voz grabada</strong></div><audio controls src={audioUrl} preload="metadata"/><button type="button" className="outline-button" onClick={downloadAudio}><Download size={16}/> Descargar audio</button></div>}
              <p className="caveat">Las voces se prueban hablando con GPT-Live. Al enviar un guion se añade contexto: el modelo puede parafrasear, no es una lectura TTS literal.</p>
              <audio ref={audioRef} autoPlay playsInline style={{display:"none"}}/>
            </section>
            <section className="presets-panel panel"><div className="section-title"><div className="panel-title"><span className="icon-square amber"><Zap size={19}/></span><div><h2>Inspiración para tu voz</h2><p>Ideas para encontrar el estilo ideal</p></div></div></div><div className="preset-list">{presets.map((preset,i)=><button key={preset.label} type="button" className="preset-row" onClick={()=>{setStyle(s=>({...s,detail:preset.detail,pace:i===1?4:i===2?2:3,expressiveness:i===1?5:i===2?2:3}));inform(`Ajustes de «${preset.label}» aplicados. Crea una nueva voz para oírlos.`,"ok");}}><div className={`preset-icon preset-${i}`}>{i===0?<Heart size={18}/>:i===1?<Radio size={18}/>:<Moon size={18}/>}</div><div><strong>{preset.label}</strong><span>{preset.tone}</span></div><span className="preset-arrow">↗</span></button>)}</div><div className="preset-tip"><CircleHelp size={16}/> Los ajustes son descripciones para el modelo, no controles de procesamiento del audio generado.</div></section>
          </div>
        </>}
        {section==="voices"&&<><div className="page-heading"><div><div className="eyebrow"><span className="pulse-icon"/> TU COLECCIÓN</div><h1>Tu biblioteca de voces<span>.</span></h1><p>Las voces que has creado mediante Prompt-to-Voice.</p></div><button type="button" className="primary-button heading-button" onClick={()=>setSection("studio")}><Plus size={18}/> Nueva voz</button></div><div className="library-heading"><h2>{voices.length} {voices.length===1?"voz guardada":"voces guardadas"}</h2><span>Guardadas en este navegador</span></div><div className="library-grid">{voices.map(v=><article className="voice-card panel" key={v.id}><div className="voice-card-top"><div className="voice-card-art"><AudioWaveform size={22}/></div><span>GPT-LIVE</span></div><h3>{v.name}</h3><div className="voice-date"><Clock3 size={13}/>{fmt(v.createdAt)}</div><p>{v.prompt}</p><div className="voice-id">{v.id}</div><div className="voice-card-footer"><button type="button" className="primary-button small" onClick={()=>chooseVoice(v)}><Play size={14}/> Probar voz</button><button type="button" className="icon-button" title="Quitar de la biblioteca local" onClick={()=>clearVoice(v.id)}><X size={17}/></button></div></article>)}{voices.length===0&&<div className="empty-library panel"><Library size={32}/><h2>Aún no has creado voces</h2><p>Vuelve al estudio para diseñar y guardar tu primera voz original.</p><button type="button" className="primary-button" onClick={()=>setSection("studio")}><Plus size={18}/> Crear voz</button></div>}</div><div className="saved-scripts panel"><div className="panel-title"><span className="icon-square lavender"><FolderOpen size={18}/></span><div><h2>Guiones guardados</h2><p>Versiones locales de tus textos</p></div></div>{scripts.length? scripts.map(item=><button type="button" className="script-row" key={item.id} onClick={()=>{setScript(item.content);setScriptName(item.name);setSection("studio");inform(`Guion «${item.name}» cargado.`,"ok");}}><FileText size={18}/><div><strong>{item.name}</strong><span>{item.content.slice(0,92)}{item.content.length>92?"…":""}</span></div><small>{fmt(item.updatedAt)}</small></button>):<div className="saved-empty">Todavía no hay guiones guardados.</div>}</div></>}
        {section==="guide"&&<><div className="page-heading"><div><div className="eyebrow"><span className="pulse-icon"/> DOCUMENTACIÓN</div><h1>Cómo funciona Voice Studio<span>.</span></h1><p>Un flujo práctico para diseñar voces naturales con la API de OpenAI.</p></div></div><div className="guide-list"><div className="panel guide-card"><span className="guide-number">01</span><div><h2>Configura tu API</h2><p>Crea el archivo <code>.env.local</code> usando <code>.env.example</code>. Agrega tu clave de OpenAI Platform. Nunca la pegues en la interfaz web ni la subas a GitHub.</p></div></div><div className="panel guide-card"><span className="guide-number">02</span><div><h2>Diseña una voz original</h2><p>Modifica el acento, la presentación, el timbre y la expresividad. Los controles generan una descripción lingüística. Haz clic en «Crear mi voz» para registrar una nueva voz en tu proyecto de OpenAI.</p></div></div><div className="panel guide-card"><span className="guide-number">03</span><div><h2>Escucha la voz con GPT-Live</h2><p>Selecciona una voz, inicia una sesión y concede acceso al micrófono. Habla en español para escuchar cómo responde. Puedes enviar un guion como contexto y pedirle que lo narre, pero no hay garantía de literalidad.</p></div></div><div className="panel guide-card"><span className="guide-number">04</span><div><h2>Guarda la muestra de audio</h2><p>Al terminar, el navegador prepara una grabación de la voz de GPT-Live en WebM (o M4A donde esté disponible). Puedes reproducir y descargar el resultado de esa sesión.</p></div></div><div className="guide-links"><a href="https://developers.openai.com/api/docs/guides/custom-voices" target="_blank" rel="noreferrer">Documentación: Custom Voices ↗</a><a href="https://developers.openai.com/api/docs/guides/voice-webrtc" target="_blank" rel="noreferrer">Documentación: WebRTC ↗</a></div><div className="panel guide-card warning"><CircleHelp size={22}/><div><h2>Antes de publicar</h2><p>Esta versión es un MVP local sin cuentas de usuario ni límites de consumo. Para alojarlo públicamente necesitamos autenticación, control de costos, límites por usuario y persistencia en base de datos. Identifica siempre el contenido de audio como generado por IA.</p></div></div></div></>}
      </main>
      <footer className="footer"><span>Voice Studio v0.1 · Audio generado por inteligencia artificial</span><span>Diseñado para crear, explorar e imaginar <span className="footer-spark">✦</span></span></footer>
    </div>
  </div>;
}
