"use client";

import { FormEvent, useMemo, useState } from "react";

type AppId =
  | "overview" | "chat" | "agents" | "media" | "memory" | "browser"
  | "terminal" | "plugins" | "tailscale" | "github" | "vault" | "models" | "jobs"
  | "security" | "settings";

type App = {
  id: AppId;
  label: string;
  symbol: string;
  tone: string;
  badge?: number;
};

const apps: App[] = [
  { id: "overview", label: "DUE", symbol: "D", tone: "blue" },
  { id: "chat", label: "Chat", symbol: "◌", tone: "aqua", badge: 4 },
  { id: "agents", label: "Agenti", symbol: "✦", tone: "violet", badge: 6 },
  { id: "media", label: "Studio", symbol: "◈", tone: "magenta" },
  { id: "memory", label: "Memoria", symbol: "⌘", tone: "amber" },
  { id: "browser", label: "Browser", symbol: "◎", tone: "sky" },
  { id: "terminal", label: "Terminale", symbol: ">_", tone: "graphite" },
  { id: "plugins", label: "Plugin Lab", symbol: "⌬", tone: "indigo", badge: 3 },
  { id: "tailscale", label: "Tailscale", symbol: "⁙", tone: "tailscale", badge: 3 },
  { id: "github", label: "GitHub", symbol: "⑂", tone: "graphite", badge: 3 },
  { id: "vault", label: "Portachiavi", symbol: "◆", tone: "gold", badge: 12 },
  { id: "models", label: "Modelli & GPU", symbol: "▦", tone: "green" },
  { id: "jobs", label: "Lavori", symbol: "☷", tone: "orange", badge: 5 },
  { id: "security", label: "Sicurezza", symbol: "⬡", tone: "teal" },
  { id: "settings", label: "Preferenze", symbol: "⚙", tone: "steel" },
];

const agents = [
  { name: "DUE Core", role: "Orchestrazione generale", state: "Operativo", tasks: 12, model: "Nemotron 3 Nano", color: "#2879c8" },
  { name: "Atelier", role: "Immagini, video e audio", state: "Elabora", tasks: 4, model: "Cosmos + Magpie", color: "#a14db4" },
  { name: "GitHub Manager", role: "Repository e CI/CD", state: "Operativo", tasks: 7, model: "Nemotron Super", color: "#404b56" },
  { name: "Web Scout", role: "Ricerca e browser", state: "In pausa", tasks: 0, model: "Nemotron Nano", color: "#1594ba" },
  { name: "Memory Steward", role: "Memoria persistente", state: "Operativo", tasks: 18, model: "Nemotron Embed", color: "#d88e25" },
  { name: "Security Guard", role: "Policy e autorizzazioni", state: "Operativo", tasks: 31, model: "Nemotron Nano", color: "#249879" },
];

function AppIcon({ app, small = false }: { app: App; small?: boolean }) {
  return (
    <span className={`app-icon tone-${app.tone} ${small ? "small" : ""}`}>
      <i>{app.symbol}</i>
      {app.badge ? <b>{app.badge}</b> : null}
    </span>
  );
}

function Header({
  kicker,
  title,
  copy,
  action,
}: {
  kicker: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div><small>{kicker}</small><h1>{title}</h1><p>{copy}</p></div>
      {action}
    </header>
  );
}

function Overview({ open }: { open: (id: AppId) => void }) {
  return (
    <div className="page overview">
      <section className="welcome">
        <span className="due-orb">D<i/><i/></span>
        <div>
          <small>VPS DUE · GOOGLE CLOUD</small>
          <h1>DUE è operativo.</h1>
          <p>Il tuo ambiente AI privato per agenti, produzione multimediale e infrastruttura.</p>
          <button className="primary" onClick={() => open("chat")}>Parla con DUE</button>
        </div>
        <aside><i className="online"/>Tutti i sistemi nominali<small>Verifica 24 secondi fa</small></aside>
      </section>

      <div className="metrics">
        {[
          ["Agenti", "7", "6 attivi · 1 supervisionato", "✦", "blue"],
          ["GPU", "68%", "RTX PRO 6000 · 96 GB", "▦", "green"],
          ["Lavori", "5", "2 attivi · 3 in attesa", "☷", "orange"],
          ["Memorie", "12.482", "Mem0 · Graphiti · pgvector", "⌘", "violet"],
        ].map((m) => (
          <article className="aqua-card metric" key={m[0]}>
            <span className={`metric-icon metric-${m[4]}`}>{m[3]}</span>
            <div><small>{m[0]}</small><strong>{m[1]}</strong><p>{m[2]}</p></div>
          </article>
        ))}
      </div>

      <div className="overview-grid">
        <section className="aqua-panel agents-live">
          <PanelTitle kicker="SQUADRA" title="Agenti in attività" action="Mostra tutti" onAction={() => open("agents")}/>
          {agents.slice(0, 4).map((agent) => (
            <button className="agent-line" key={agent.name} onClick={() => open("agents")}>
              <span className="agent-avatar" style={{ "--agent": agent.color } as React.CSSProperties}>{agent.name[0]}</span>
              <span><b>{agent.name}</b><small>{agent.role}</small></span>
              <em className={agent.state === "Elabora" ? "busy" : agent.state === "In pausa" ? "paused" : ""}>{agent.state}</em>
              <i>{agent.tasks} task</i><strong>›</strong>
            </button>
          ))}
        </section>

        <section className="aqua-panel gpu-panel">
          <PanelTitle kicker="HARDWARE" title="RTX PRO 6000" action="LIVE"/>
          <div className="gpu-body">
            <div className="gpu-ring"><span><b>68%</b><small>65,3 / 96 GB</small></span></div>
            <div><b>Nemotron 3 Nano</b><small>modello caricato</small>
              <dl><div><dt>Velocità</dt><dd>46 tok/s</dd></div><div><dt>Temp.</dt><dd>62°C</dd></div><div><dt>Power</dt><dd>391 W</dd></div></dl>
            </div>
          </div>
          <button className="secondary full" onClick={() => open("models")}>Apri Gestione Modelli</button>
        </section>

        <section className="aqua-panel recent-jobs">
          <PanelTitle kicker="PRODUZIONE" title="Lavori recenti" action="Apri coda" onAction={() => open("jobs")}/>
          {[
            ["Trailer campagna · 12 sec", "Atelier", 68, "2m 14s", "◈"],
            ["Analisi PR #184", "GitHub Manager", 42, "38s", "⑂"],
            ["Voiceover italiano", "Atelier", 0, "in coda", "♫"],
          ].map((job) => (
            <div className="job-line" key={job[0]}>
              <span>{job[4]}</span><p><b>{job[0]}</b><small>{job[1]}</small></p>
              <i><b style={{ width: `${job[2]}%` }}/></i><em>{job[2]}%</em><small>{job[3]}</small>
            </div>
          ))}
        </section>

        <section className="aqua-panel due-activity">
          <PanelTitle kicker="DUE CORE" title="Attività" action="•••"/>
          {[
            ["✓", "Backup completato", "Memoria e Portachiavi · 19:38"],
            ["⑂", "PR #184 analizzata", "2 osservazioni · 19:34"],
            ["↻", "Modello sostituito", "Omni → Nano · 19:29"],
          ].map((item) => <div key={item[1]}><span>{item[0]}</span><p><b>{item[1]}</b><small>{item[2]}</small></p></div>)}
        </section>
      </div>
    </div>
  );
}

function PanelTitle({ kicker, title, action, onAction }: { kicker: string; title: string; action: string; onAction?: () => void }) {
  return <header className="panel-title"><div><small>{kicker}</small><h2>{title}</h2></div><button onClick={onAction}>{action}</button></header>;
}

function Chat() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([
    ["due", "Buonasera Giacomo. GPU, memoria, browser e Portachiavi sono operativi."],
    ["user", "Controlla le PR e prepara il riepilogo di oggi."],
    ["due", "Fatto. Ci sono tre PR aperte; una pipeline presenta un test instabile. Ho preparato il riepilogo senza modificare repository."],
  ]);
  function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages((m) => [...m, ["user", text.trim()]]);
    setText("");
    setTimeout(() => setMessages((m) => [...m, ["due", "Ricevuto. Ho avviato il task in modalità controllata; mostrerò l’anteprima prima di azioni esterne."]]), 300);
  }
  return (
    <div className="chat-layout">
      <aside className="conversations">
        <button className="new-chat">＋ Nuova conversazione</button>
        <label>⌕ <input placeholder="Cerca"/></label>
        <small>OGGI</small>
        {["Riepilogo operativo", "PR e pipeline", "Campagna estate", "Ricerca competitor"].map((c, i) => (
          <button className={i === 0 ? "active" : ""} key={c}><span>◌</span><p><b>{c}</b><small>{i ? "oggi" : "2 min fa"}</small></p>{i === 0 ? <i/> : null}</button>
        ))}
      </aside>
      <section className="chat-main">
        <header><span className="due-avatar">D</span><div><h2>DUE Core</h2><small><i className="online"/>online · Nemotron Auto</small></div><button>◉</button><button>•••</button></header>
        <main>{messages.map((m, i) => <div className={`message ${m[0]}`} key={i}>{m[0] === "due" ? <span className="due-avatar small">D</span> : null}<div><p>{m[1]}</p><small>{m[0] === "due" ? "DUE · ora" : "Tu · ora"}</small></div></div>)}</main>
        <form className="composer" onSubmit={send}><div><button type="button">＋</button><textarea aria-label="Messaggio" value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi a DUE…"/><button className="send">➤</button></div><footer><button>Auto</button><button>◎ Web</button><button>▧ Immagine</button><button>▷ Video</button><span>Invio per spedire</span></footer></form>
      </section>
    </div>
  );
}

function Agents() {
  const [selected, setSelected] = useState<number | null>(null);
  const [create, setCreate] = useState(false);
  if (selected !== null) {
    const agent = agents[selected];
    return <div className="page agent-detail">
      <button className="back" onClick={() => setSelected(null)}>‹ Tutti gli agenti</button>
      <section className="aqua-panel agent-hero"><span className="agent-avatar xl" style={{ "--agent": agent.color } as React.CSSProperties}>{agent.name[0]}</span><div><small>AGENTE · DUE-{String(selected + 1).padStart(3, "0")}</small><h1>{agent.name}</h1><p>{agent.role}</p></div><em>Operativo</em><button className="secondary">Pausa</button><button className="primary">Apri chat</button></section>
      <nav className="segmented">{["Panoramica", "Istruzioni", "Strumenti", "Memoria", "Credenziali", "Automazioni", "Log"].map((x, i) => <button className={i === 0 ? "active" : ""} key={x}>{x}</button>)}</nav>
      <div className="agent-detail-grid"><section className="aqua-panel"><PanelTitle kicker="IDENTITÀ" title="Istruzioni principali" action="Modifica"/><div className="prompt-box"><small>SYSTEM PROMPT</small><p>Sei {agent.name}, specializzato in {agent.role.toLowerCase()}. Operi sotto DUE Core, utilizzi solo strumenti autorizzati e richiedi conferma prima di azioni con impatto esterno.</p></div><div className="config-grid">{[["Modello", agent.model, "Routing automatico"], ["Autonomia", "Controllata", "Conferma esterna"], ["Contesto", "32.000 token", "Compattazione"]].map(c => <div key={c[0]}><small>{c[0]}</small><b>{c[1]}</b><span>{c[2]}</span></div>)}</div></section><section className="aqua-panel"><PanelTitle kicker="OGGI" title="Prestazioni" action="98,7%"/>{[["Precisione",99],["Velocità",87],["Uso strumenti",93]].map(x => <div className="performance" key={x[0]}><span>{x[0]}</span><i><b style={{width:`${x[1]}%`}}/></i><em>{x[1]}%</em></div>)}<hr/><h3>Strumenti autorizzati</h3><div className="tool-tags"><span>⑂ GitHub</span><span>◎ Browser</span><span>⌘ Memoria</span><span>◆ 3 chiavi</span></div></section></div>
    </div>;
  }
  return <div className="page"><Header kicker="SQUADRA DUE" title="Agenti" copy="Crea, configura e osserva ogni componente della squadra AI." action={<button className="primary" onClick={() => setCreate(true)}>＋ Nuovo agente</button>}/><div className="agent-grid">{agents.map((a, i) => <article className="aqua-card agent-card" key={a.name}><header><span className="agent-avatar xl" style={{"--agent":a.color} as React.CSSProperties}>{a.name[0]}</span><em>{a.state}</em><button>•••</button></header><h2>{a.name}</h2><p>{a.role}</p><dl><div><dt>Task</dt><dd>{a.tasks}</dd></div><div><dt>Memoria</dt><dd>{i === 4 ? "7,8 GB" : `${i + 1},${i} GB`}</dd></div><div><dt>Successo</dt><dd>{i === 3 ? "—" : `${99 - i/2}%`}</dd></div></dl><footer><small>{a.model}</small><button onClick={() => setSelected(i)}>Apri centro agente ›</button></footer></article>)}</div>{create ? <div className="modal-layer" onMouseDown={() => setCreate(false)}><form className="aqua-modal" onMouseDown={e => e.stopPropagation()} onSubmit={e => {e.preventDefault();setCreate(false)}}><header><span className="traffic"><i/><i/><i/></span><b>Crea un agente</b></header><main><span className="due-orb small">D</span><h2>Nuovo componente DUE</h2><label>Nome<input required placeholder="es. Catalog Manager"/></label><label>Missione<textarea required placeholder="Cosa deve fare e quale risultato deve ottenere?"/></label><div><label>Modello<select><option>Automatico</option><option>Nemotron Nano</option></select></label><label>Autonomia<select><option>Controllata</option><option>Supervisionata</option></select></label></div><p>⬡ Strumenti e credenziali vengono assegnati dopo la creazione.</p></main><footer><button type="button" onClick={() => setCreate(false)}>Annulla</button><button className="primary">Crea agente</button></footer></form></div> : null}</div>;
}

function Media() {
  const [tab, setTab] = useState("Video");
  return <div className="page"><Header kicker="ATELIER DUE" title="Studio creativo" copy="Genera, monta e consegna contenuti con i modelli NVIDIA locali." action={<button className="primary">＋ Nuovo progetto</button>}/><nav className="media-tabs">{["Video","Immagini","Audio"].map(x => <button className={tab === x ? "active":""} key={x} onClick={() => setTab(x)}>{x}</button>)}</nav>{tab === "Video" ? <div className="media-layout"><aside className="aqua-panel media-controls"><h2>Genera clip</h2><label>Prompt<textarea defaultValue="Un vigneto italiano all’alba, luce cinematografica, movimento dolce della camera…"/></label><div><label>Durata<select><option>12 secondi</option></select></label><label>Formato<select><option>16:9</option></select></label></div><label>Modello<select><option>Cosmos Predict 2.5</option></select></label><button className="primary full">✦ Genera video</button><p>◷ Stima: 6–9 minuti<br/><small>56 GB VRAM · priorità normale</small></p></aside><section className="aqua-panel video-editor"><header><button>▶</button><button>Ⅱ</button><span>00:00:06:12 / 00:00:12:00</span><button>1080p</button><button>Esporta</button></header><div className="video-preview"><small>PROGETTO DUE</small><h2>Ogni idea<br/>trova la sua forma.</h2><span>Anteprima generativa</span></div><div className="timeline"><header><b>Timeline</b><span>− 100% ＋</span></header>{[["Video","clip 01","clip 02"],["Voce","voiceover",""],["Musica","ambient score",""]].map((r,i) => <div className="track" key={r[0]}><b>{r[0]}</b><main><i className={`clip clip-${i}`}>{r[1]}</i>{r[2] ? <i className="clip alt">{r[2]}</i>:null}</main></div>)}</div></section></div> : <div className="asset-grid">{Array.from({length:6}).map((_,i) => <article className={`asset asset-${i}`} key={i}><span>{tab === "Audio" ? "♫" : "◈"}</span><footer><b>{tab === "Audio" ? "Voce italiana" : "Visual campagna"} {i+1}</b><button>•••</button></footer></article>)}</div>}</div>
}

function Memory() {
  return <div className="page"><Header kicker="MEMORIA PERSISTENTE" title="Conoscenza DUE" copy="Il Memory Steward richiama decisioni e contesto senza esporre segreti." action={<button className="primary">＋ Nuova memoria</button>}/><section className="aqua-panel memory-hero"><span className="memory-orb">⌘</span><div><small>MEMORY STEWARD</small><h2>Memoria sana e indicizzata</h2><p>Mem0, Graphiti e pgvector dietro un singolo agente mnemonico.</p></div>{[["Ricordi","12.482"],["Collegamenti","34.901"],["Recall medio","82 ms"]].map(x => <dl key={x[0]}><dt>{x[0]}</dt><dd>{x[1]}</dd></dl>)}</section><div className="memory-layout"><aside className="aqua-panel memory-filters"><small>RACCOLTE</small>{[["Tutto","12.482"],["Decisioni","1.204"],["Preferenze","486"],["Progetti","2.813"],["Tecnica","7.785"]].map((x,i) => <button className={i===0?"active":""} key={x[0]}><span>{x[0]}</span><small>{x[1]}</small></button>)}</aside><section className="aqua-panel memory-feed"><label>⌕ <input placeholder="Cerca nella memoria…"/></label>{[["Decisione","Il progetto e il modello della VPS si chiamano DUE.","Architettura · 2 min fa"],["Preferenza","Ogni azione esterna mostra un’anteprima e richiede conferma.","Sicurezza · oggi"],["Tecnica","ByteRover viene usato soltanto come memoria tecnica di repository.","GitHub · ieri"],["Progetto","La VPS usa g4-standard-48 e RTX PRO 6000 Blackwell da 96 GB.","Infrastruttura · 3 giorni fa"]].map((m,i) => <article key={m[1]}><span className={`kind kind-${i}`}>{m[0]}</span><p>{m[1]}</p><footer><small>{m[2]}</small><button>•••</button></footer></article>)}</section></div></div>;
}

function Browser() {
  const [url, setUrl] = useState("https://developer.nvidia.com/");
  const [shown, setShown] = useState(url);
  return <div className="browser"><nav><button className="active"><span>N</span>NVIDIA Developer <i>×</i></button><button>＋</button><em>⬡ Sessione isolata</em></nav><form onSubmit={e => {e.preventDefault();setShown(url)}}><button type="button">‹</button><button type="button">›</button><button type="button">↻</button><label>◆ <input aria-label="Indirizzo web" value={url} onChange={e => setUrl(e.target.value)}/></label><button className="primary">Vai</button><button type="button">⇩</button></form><div><aside><small>SESSIONI AGENTI</small>{["Web Scout","DUE Core","GitHub Manager"].map((x,i) => <button className={i===0?"active":""} key={x}><i className="online"/><span><b>{x}</b><small>{i===0?"questa scheda":i===1?"2 schede":"inattivo"}</small></span></button>)}<hr/><small>RACCOLTE</small><button>▰ Ricerca corrente</button><button>◷ Cronologia</button><button>⇩ Download</button></aside><main><section className="web-page"><header><span>N</span><b>NVIDIA</b><nav>Products &nbsp; Solutions &nbsp; Research</nav></header><div><small>BROWSER GATEWAY DUE</small><h1>Esplora il web.<br/>Conserva ciò che conta.</h1><p>Ogni sessione è separata, osservabile e sottoposta a scansione.</p><code>{shown}</code><footer><button>Acquisisci pagina</button><button>Chiedi a DUE</button></footer></div><aside><span>⬡ Injection scan</span><span>◉ Sessione osservabile</span><span>◷ Limite 15 min</span></aside></section></main></div></div>;
}

function Terminal() {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState(["DUE Secure Terminal · due-main · policy controlled","✓ OpenClaw runtime online · RTX PRO 6000 disponibile","due@workstation:~$ openclaw status --compact","agents 6/6 · jobs 5 · memory healthy · vault unsealed"]);
  function run(e: FormEvent) {e.preventDefault();if(!command.trim())return;const c=command.trim();setLines(l=>[...l,`due@workstation:~$ ${c}`,/sudo|rm |systemctl|docker/.test(c)?"⬡ Azione privilegiata inviata al Policy Engine.":c==="help"?"Comandi: status, agents, gpu, jobs, memory.":"Task accodato nel terminale controllato."]);setCommand("")}
  return <div className="terminal"><aside><small>SESSIONI</small>{[["due-main","DUE Core","online"],["media-worker","Atelier","busy"],["gh-runner","GitHub Manager","idle"]].map((x,i) => <button className={i===0?"active":""} key={x[0]}><i className={x[2]}/><span><b>{x[0]}</b><small>{x[1]}</small></span></button>)}<button>＋ Nuova sessione</button><div><b>⬡ Sudo mediato</b><p>Wrapper, policy, conferma e audit per ogni comando privilegiato.</p></div></aside><main><header><span>due-main — 120×36</span><span><i/>audit attivo</span></header><section>{lines.map((l,i)=><p className={l.startsWith("due@")?"cmd":l.startsWith("⬡")?"warn":l.startsWith("✓")?"ok":""} key={i}>{l}</p>)}<form onSubmit={run}><b>due@workstation:~$</b><input aria-label="Comando terminale" value={command} onChange={e=>setCommand(e.target.value)} placeholder="digita help…"/></form></section><footer><span>UTF-8</span><span>zsh</span><span>Policy: controlled</span></footer></main></div>;
}

function Plugins() {
  const [queue,setQueue]=useState<string[]>([]);
  const list=[["Design Lab","0xdesign","Varianti, feedback visuale e Design Memory.","D","#2879c8"],["Apple Design","emilkowalski","Motion fluido, feedback immediato e continuità.","A","#737c87"],["Taste Skill","Leonxlnx","Revisione anti-slop e disciplina progettuale.","T","#7b55ad"]];
  return <div className="page"><Header kicker="EXTENSION MANAGER" title="Plugin Lab" copy="DUE evolve in sicurezza: scoperta, quarantena, test, approvazione e rollback." action={<button className="primary">＋ Importa pacchetto</button>}/><section className="aqua-panel plugin-pipeline"><span>⌬</span><div><small>EVOLUZIONE CONTROLLATA</small><h2>Il sistema migliora. La produzione resta protetta.</h2><p>Gli agenti propongono strumenti e UI, mai installazioni dirette in produzione.</p></div><ol>{["Scoperta","Scansione","Sandbox","Approvazione","Rilascio"].map((x,i)=><li key={x}><b>{i+1}</b><span>{x}</span></li>)}</ol></section><div className="plugin-layout"><section className="aqua-panel"><PanelTitle kicker="UI ABILITIES" title="Kit di miglioramento" action="3 disponibili"/><div className="plugin-grid">{list.map(p=><article key={p[0]} style={{"--plugin":p[4]} as React.CSSProperties}><header><span>{p[3]}</span><div><h3>{p[0]}</h3><small>{p[1]}</small></div><button>•••</button></header><p>{p[2]}</p><div><span>filesystem: scoped</span><span>network: review</span></div><footer><small>{queue.includes(p[0])?"In scansione":"Non installato"}</small><button disabled={queue.includes(p[0])} onClick={()=>setQueue(q=>[...q,p[0]])}>{queue.includes(p[0])?"Richiesto":"Valuta"}</button></footer></article>)}</div></section><aside className="aqua-panel proposals"><PanelTitle kicker="EXPERIENCE MAINTAINER" title="Proposte" action="3"/>{[["Nuova timeline video","Visual diff pronto","◉"],["Command palette","Test 18/18","✓"],["Connettore RSS","Permessi da rivedere","⬡"]].map(p=><button key={p[0]}><span>{p[2]}</span><p><b>{p[0]}</b><small>{p[1]}</small></p><i>›</i></button>)}<div><b>⌘ Design Memory</b><p>Token, pattern approvati e feedback impediscono regressioni.</p></div></aside></div></div>;
}

function Tailscale() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("due-vps");
  const devices = [
    ["due-vps", "Linux · g4-standard-48", "100.86.12.4", "Online", "tag:due-server"],
    ["giacomo-mac", "macOS · personale", "100.97.33.18", "Online", "Giacomo"],
    ["cliente-studio", "Windows · cliente", "100.75.44.29", "7 min fa", "Cliente"],
    ["media-worker", "Linux · isolato", "100.66.19.8", "Online", "tag:due-agent"],
  ];
  return <div className="page tailscale-page">
    <Header kicker="ACCESSO PRIVATO" title="Tailscale" copy="Identità GitHub, dispositivi e permessi della rete privata DUE." action={<button className="primary github-login" onClick={() => setLoginOpen(true)}>⑂ Login con GitHub</button>}/>

    <section className="aqua-panel tailnet-hero">
      <span className="tailscale-mark"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span>
      <div><small>TAILNET DUE</small><h2>Rete privata connessa</h2><p>due-vps · MagicDNS attivo · HTTPS interno pronto</p></div>
      <div className="identity-chip"><span>G</span><p><small>IDENTITÀ OWNER</small><b>giacomo-zavattoni</b></p><i className="online"/></div>
      <button className="secondary" onClick={() => setLoginOpen(true)}>Gestisci accesso</button>
    </section>

    <div className="tail-metrics">
      {[["Utenti","3","GitHub verificati","♙"],["Dispositivi","4","3 online","▱"],["MagicDNS","Attivo","due-vps","◎"],["SSH policy","2","check mode","⌘"]].map(x=><article className="aqua-card" key={x[0]}><span>{x[3]}</span><p><small>{x[0]}</small><b>{x[1]}</b><em>{x[2]}</em></p></article>)}
    </div>

    <div className="tailscale-grid">
      <section className="aqua-panel tail-devices">
        <PanelTitle kicker="TAILNET" title="Dispositivi" action="4 registrati"/>
        <div className="tail-table-head"><span>Dispositivo</span><span>Indirizzo</span><span>Identità / tag</span><span>Stato</span></div>
        {devices.map(d=><button className={selectedDevice===d[0]?"selected":""} key={d[0]} onClick={()=>setSelectedDevice(d[0])}><i className={d[3]==="Online"?"online":""}/><p><b>{d[0]}</b><small>{d[1]}</small></p><code>{d[2]}</code><em>{d[4]}</em><strong>{d[3]}</strong><span>›</span></button>)}
      </section>

      <aside className="aqua-panel tail-access">
        <PanelTitle kicker="IDENTITÀ & GRANTS" title="Accesso" action="Deny by default"/>
        <div className="access-owner"><span>G</span><p><small>GITHUB OWNER</small><b>giacomo-zavattoni</b><em>Owner · MFA via GitHub</em></p><i>✓</i></div>
        {[["Owner","DUE Web · SSH check · Admin","owner"],["Cliente","DUE Web · nessuna shell","client"],["Agenti","Servizi interni · scope limitato","agent"]].map(x=><div className="grant-row" key={x[0]}><span className={`grant-${x[2]}`}>{x[0][0]}</span><p><b>{x[0]}</b><small>{x[1]}</small></p><i>›</i></div>)}
        <button className="secondary full">Apri policy editor</button>
      </aside>
    </div>

    <div className="tailscale-bottom">
      <section className="aqua-panel secure-endpoint"><span>◆</span><div><small>ENDPOINT PRIVATO</small><h3>https://due-vps.&lt;tailnet&gt;.ts.net</h3><p>Tailscale Serve → BFF DUE su 127.0.0.1. Non esposto su Internet.</p></div><button>Copia</button></section>
      <section className="aqua-panel login-flow"><small>FLUSSO DI ACCESSO</small><div><span>⑂<b>GitHub</b></span><i>›</i><span>⁙<b>Tailnet</b></span><i>›</i><span>⬡<b>Grants</b></span><i>›</i><span>D<b>DUE</b></span></div></section>
    </div>

    {loginOpen ? <div className="modal-layer" onMouseDown={()=>setLoginOpen(false)}><section className="aqua-modal tailscale-login" onMouseDown={e=>e.stopPropagation()}><header><span className="traffic"><i/><i/><i/></span><b>Accedi a DUE</b></header><main><span className="tailscale-mark large"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span><h2>Entra nella tailnet DUE</h2><p>L’identità viene verificata da GitHub attraverso Tailscale. DUE non riceve né conserva la tua password GitHub.</p><button className="github-oauth" onClick={()=>setLoginOpen(false)}><b>⑂</b> Continua con GitHub</button><small>Richiede un account autorizzato nelle policy DUE.</small><div>⬡ La sessione applicativa viene creata solo dopo la verifica dell’identità Tailscale.</div></main><footer><button onClick={()=>setLoginOpen(false)}>Annulla</button></footer></section></div>:null}
  </div>;
}

function Generic({ id }: { id: AppId }) {
  const data: Record<string, [string,string,string,string,string[][]]> = {
    github:["GITHUB MANAGER","Repository e automazioni","PR, Actions e query native attraverso GitHub CLI.","⑂",[["PR #184 · Stabilize model router","Checks 5/6","Review"],["PR #181 · Memory audit export","Checks 8/8","Ready"],["PR #176 · Media worker retry","Draft","Open"]]],
    vault:["OPENBAO","Portachiavi","Chiavi, password e lease senza esporre valori agli agenti.","◆",[["GitHub · DUE","GitHub App","Attiva"],["NVIDIA NGC","API key","Attiva"],["Google Cloud","Service account","Attiva"],["Hugging Face","Token read","Attiva"],["DNS pianodivino.com","API token","Scade tra 12g"]]],
    models:["NVIDIA STACK","Modelli & GPU","Caricamento modelli, VRAM, throughput e routing.","▦",[["Nemotron 3 Nano","Chat e agenti","In GPU · 34 GB"],["Nemotron 3 Super","Ragionamento","Su disco · 61 GB"],["Nemotron 3 Omni","Multimodale","Su disco · 43 GB"],["Cosmos Predict 2.5","Video","Su disco · 56 GB"],["Magpie TTS","Audio","Pronto · 3 GB"]]],
    jobs:["PRODUZIONE","Coda lavori","Task attivi, in attesa e completati da tutta la squadra.","☷",[["Trailer campagna","Atelier","68%"],["Analisi PR #184","GitHub Manager","42%"],["Voiceover italiano","Atelier","In coda"],["Indicizzazione memoria","Memory Steward","In coda"],["Backup cifrato","DUE Core","Completato"]]],
    security:["SECURITY GUARD","Sicurezza & Audit","Policy, sessioni, sudo e azioni privilegiate.","⬡",[["Firewall e rete privata","Security Guard","Operativo"],["Vault e rotazione","Credential Broker","Operativo"],["Audit sudo","Policy Engine","Registrazione attiva"],["Browser sandbox","Web Gateway","3 sessioni"],["Backup verificato","DUE Core","Oggi · 03:00"]]],
    settings:["SISTEMA","Preferenze DUE","Identità, utenti, dominio, backup e aggiornamenti.","⚙",[["Identità","Nome progetto","DUE"],["Dominio","Endpoint cliente","ai.pianodivino.com"],["Utenti","Account attivi","2"],["Backup","Ultima esecuzione","Oggi · 03:00"],["Aggiornamenti","Canale","Stable"]]],
  };
  const d=data[id];
  return <div className="page"><Header kicker={d[0]} title={d[1]} copy={d[2]} action={<button className="primary">＋ Nuova azione</button>}/>{id==="models"?<section className="aqua-panel hardware"><span>N</span><div><small>DUE / G4-STANDARD-48</small><h2>NVIDIA RTX PRO 6000 Blackwell</h2><p>96 GB VRAM · driver 580.65 · CUDA 13.0</p></div>{[["GPU","68%"],["VRAM","65,3 GB"],["Temp.","62°C"],["Power","391 W"]].map(x=><dl key={x[0]}><dt>{x[0]}</dt><dd>{x[1]}</dd></dl>)}</section>:null}<section className="aqua-panel list-panel"><header><label>⌕ <input placeholder={`Cerca in ${d[1]}…`}/></label><button>↻ Aggiorna</button></header><div className="list-head"><span>Nome</span><span>Gestore / Tipo</span><span>Stato</span></div>{d[4].map(r=><button className="list-row" key={r[0]}><span>{d[3]}</span><b>{r[0]}</b><em>{r[1]}</em><i className={r[2].includes("Scade")||r[2].includes("5/6")?"warn":""}>{r[2]}</i><strong>›</strong></button>)}</section></div>;
}

export default function Home() {
  const [active, setActive] = useState<AppId>("overview");
  const [maximized, setMaximized] = useState(false);
  const current = useMemo(() => apps.find((app) => app.id === active)!, [active]);
  const content = active === "overview" ? <Overview open={setActive}/> : active === "chat" ? <Chat/> : active === "agents" ? <Agents/> : active === "media" ? <Media/> : active === "memory" ? <Memory/> : active === "browser" ? <Browser/> : active === "terminal" ? <Terminal/> : active === "plugins" ? <Plugins/> : active === "tailscale" ? <Tailscale/> : <Generic id={active}/>;
  return <main className="desktop">
    <header className="menu-bar"><span className="menu-logo">D</span><b>DUE</b><nav><button>File</button><button>Modifica</button><button>Vista</button><button>Agenti</button><button>Finestra</button><button>Aiuto</button></nav><aside><span>▦ 68%</span><span>◔</span><span>⌕</span><span>Ven 24 lug&nbsp; 19:42</span><button>◌<i>3</i></button></aside></header>
    <div className="desktop-icons"><button><span>▣</span><b>DUE HD</b></button><button><span>▰</span><b>Progetti</b></button><button><span>↻</span><b>Backup</b></button></div>
    <section className={`main-window ${maximized ? "maximized" : ""}`}>
      <header className="window-title"><span className="traffic"><i/><i/><button onClick={() => setMaximized(v=>!v)}/></span><b><AppIcon app={current} small/>{current.label}</b><small>DUE · sessione protetta</small></header>
      <div className="window-toolbar"><div className="back-forward"><button>‹</button><button>›</button></div><div className="current-app"><AppIcon app={current} small/><span><b>{current.label}</b><small>OpenClaw Workstation</small></span></div><label>⌕ <input placeholder="Cerca o usa ⌘ K"/></label><button><i className="online"/>Sistema operativo</button></div>
      <div className="window-body"><aside className="source-list"><small>FAVORITI</small>{apps.slice(0,8).map(a=><button className={active===a.id?"active":""} key={a.id} onClick={()=>setActive(a.id)}><AppIcon app={a} small/><span>{a.label}</span>{a.badge?<b>{a.badge}</b>:null}</button>)}<small>SISTEMA</small>{apps.slice(8).map(a=><button className={active===a.id?"active":""} key={a.id} onClick={()=>setActive(a.id)}><AppIcon app={a} small/><span>{a.label}</span>{a.badge?<b>{a.badge}</b>:null}</button>)}<div className="gpu-mini"><span>▦</span><p><b>GPU · 68%</b><small>65,3 di 96 GB</small></p></div></aside><section className="app-content">{content}</section></div>
      <footer className="window-status"><span>⬡ Connessione protetta</span><span>VPS DUE · g4-standard-48</span><span>6 agenti · 5 lavori</span><i/></footer>
    </section>
    <nav className="dock">{apps.slice(0,8).map(a=><button className={active===a.id?"active":""} key={a.id} onClick={()=>setActive(a.id)}><span>{a.label}</span><AppIcon app={a}/><i/></button>)}<em/>{apps.slice(8,11).map(a=><button className={active===a.id?"active":""} key={a.id} onClick={()=>setActive(a.id)}><span>{a.label}</span><AppIcon app={a}/><i/></button>)}</nav>
  </main>;
}
