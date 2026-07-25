# DUE Workstation — handoff tecnico

## Obiettivo

Questa repository contiene la UI completa di DUE Workstation. È un frontend
navigabile e responsive, pronto per essere collegato ai
servizi reali della VPS `g4-standard-48`.

La UI comprende:

- centro di controllo generale;
- chat con UNO e conversazioni;
- elenco, creazione, configurazione e monitoraggio agenti;
- centro del singolo agente con istruzioni, strumenti, memoria, credenziali,
  automazioni e log;
- Studio Media per immagini, video, audio ed editing su timeline;
- Memory Steward e memoria persistente;
- Tailscale con identità GitHub, utenti, dispositivi, grants e endpoint privato;
- GitHub Manager, PR e GitHub Actions;
- Portachiavi e audit accessi;
- modelli NVIDIA, GPU e metriche;
- coda lavori;
- sicurezza, azioni privilegiate e log;
- impostazioni.

L'interfaccia è organizzata come **DUE Workstation**: barra menu, finestra
principale, source list, Dock, applicazioni, Browser, Terminale e Plugin Lab.
Il linguaggio visivo è ispirato a Snow Leopard/Aqua, con asset e icone
originali, mentre accessibilità, responsive design e interazioni restano
contemporanei.

## Avvio

```bash
npm ci
npm run dev
```

Build di produzione:

```bash
npm run lint
npm run build
```

## Stato del progetto

La navigazione e le interazioni locali sono implementate. I dati mostrati sono
dimostrativi e devono essere sostituiti con chiamate al backend. Non inserire
segreti, token o credenziali nel bundle frontend.

## Contratto API consigliato

| Area | Endpoint minimi |
| --- | --- |
| Sessione | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me` |
| Chat | `GET/POST /api/conversations`, `GET/POST /api/conversations/:id/messages` |
| Streaming | `GET /api/events` via SSE oppure `WS /api/ws` |
| Agenti | `GET/POST /api/agents`, `GET/PATCH /api/agents/:id`, `POST /api/agents/:id/actions` |
| Strumenti | `GET /api/tools`, `PUT /api/agents/:id/tools` |
| Memoria | `GET/POST /api/memory`, `PATCH/DELETE /api/memory/:id`, `GET /api/memory/graph` |
| Media | `POST /api/media/jobs`, `GET /api/media/jobs/:id`, `POST /api/media/projects` |
| Tailscale | `GET /api/tailscale/status`, `GET /api/tailscale/identity`, `GET /api/tailscale/users`, `GET /api/tailscale/devices`, `GET /api/tailscale/grants`, `POST /api/tailscale/devices/:id/revoke` |
| GitHub | `GET /api/github/repos`, `GET /api/github/pulls`, `GET /api/github/actions` |
| Browser | `POST /api/browser/sessions`, `GET /api/browser/sessions/:id`, `POST /api/browser/sessions/:id/actions` |
| Terminale | `POST /api/terminal/sessions`, `WS /api/terminal/sessions/:id`, `POST /api/privileged-actions` |
| Plugin Lab | `GET/POST /api/plugins`, `POST /api/plugins/:id/evaluate`, `POST /api/plugins/:id/stage`, `POST /api/plugins/:id/release` |
| Credenziali | `GET/POST /api/credentials`, `PATCH/DELETE /api/credentials/:id` |
| Modelli | `GET /api/models`, `POST /api/models/:id/load`, `GET /api/gpu/metrics` |
| Lavori | `GET /api/jobs`, `POST /api/jobs/:id/cancel`, `POST /api/jobs/:id/retry` |
| Audit | `GET /api/audit`, `GET /api/security/status` |
| Impostazioni | `GET/PATCH /api/settings` |

Le risposte del Portachiavi devono restituire soltanto metadati, scope, stato e
ultime operazioni. Il valore di una credenziale non deve mai essere restituito
al browser dopo la creazione.

## Servizi dietro la UI

```text
Browser
  -> Tailscale + identità GitHub
  -> Tailscale Serve TLS
  -> UI + API gateway
  -> OpenClaw / UNO
     -> agent runtime e policy engine
     -> model router NVIDIA
     -> media workers
     -> Memory Steward
     -> GitHub Manager
     -> credential broker
     -> queue e scheduler
```

Persistenza consigliata:

- PostgreSQL + pgvector per entità, conversazioni e ricerca vettoriale;
- Mem0 e Graphiti dietro Memory Steward;
- Redis per code, lock, sessioni effimere e streaming;
- storage a oggetti per input e output media;
- OpenBao per credenziali, lease e rotazione;
- log append-only centralizzati per audit.

## Regole di sicurezza obbligatorie

- Il cliente usa un account web senza accesso shell e senza sudo.
- Il login primario usa l'identità GitHub verificata dalla tailnet; DUE non
  riceve né conserva la password GitHub.
- Il BFF ascolta su loopback e considera affidabili gli header
  `Tailscale-User-*` soltanto se aggiunti da Tailscale Serve.
- La tailnet usa grants deny-by-default: owner con amministrazione e SSH check,
  cliente senza shell, agenti con tag e porte minime.
- Tailscale Funnel resta disabilitato. L'endpoint operativo è
  `https://due-vps.<tailnet>.ts.net`; `ai.pianodivino.com` richiede una modalità
  pubblica separata e approvata.
- Il terminale cliente espone comandi applicativi allowlistati; la PTY operatore
  richiede ruolo owner, MFA e registrazione della sessione.
- Solo il service account OpenClaw può invocare azioni privilegiate.
- Il sudo `NOPASSWD` va limitato a comandi wrapper espliciti e validati, mai a
  una shell generica.
- Ogni azione esterna, distruttiva, finanziaria o privilegiata richiede policy,
  audit e, quando previsto, conferma umana.
- GitHub usa GitHub App o token a scope minimo; `gh` viene eseguito dal backend.
- Il browser non vede mai token GitHub, chiavi modello o password.
- File media, prompt e pagine web sono input non attendibili e vanno isolati.
- Il Credential Broker risolve i segreti al momento dell'uso e non li inserisce
  nella memoria dell'agente.
- Gli agenti possono proporre plugin e miglioramenti, ma non installare codice
  web direttamente in produzione: quarantena, SBOM, scansione, manifest
  permessi, sandbox, test, PR, staging, firma e rollback sono obbligatori.

## Collegamento dei dati

Il prototipo è concentrato in `app/page.tsx` per agevolare revisione e
installazione. Per la produzione, separare le viste in componenti e sostituire
gli array dimostrativi con un client tipizzato. Mantenere le stesse chiavi di
navigazione per non alterare il comportamento della sidebar.

Suggerimento:

```text
app/
  components/
  views/
  hooks/
  lib/api.ts
  lib/events.ts
  lib/types.ts
```

Usare aggiornamenti ottimistici solo per operazioni reversibili. Per caricamento
modelli, credenziali, deploy, PR, sudo e cancellazioni, attendere sempre la
conferma del backend.

## Dominio

Pubblicare dietro HTTPS su un sottodominio dedicato, ad esempio
`ai.pianodivino.com`. Configurare cookie `Secure`, `HttpOnly`, `SameSite=Lax`,
CSRF, rate limiting, MFA amministrativa e timeout di sessione.

## Criteri di completamento

- tutti gli endpoint reali sostituiscono i dati demo;
- SSE/WebSocket aggiorna GPU, agenti e lavori senza polling aggressivo;
- login, logout, scadenza sessione e ruoli sono verificati;
- il Portachiavi non espone valori segreti;
- ogni azione privilegiata genera un evento audit;
- test end-to-end coprono chat, creazione agente, media job, GitHub e chiavi;
- build e lint passano prima del deploy.
