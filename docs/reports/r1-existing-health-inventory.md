# FASE R1 — Inventario delle interfacce health esistenti

Data: 26 luglio 2026

Origine delle informazioni: ispezione read-only dichiarata da UNO sulle VPS. Durante questa attività non risultano installazioni, modifiche di configurazione, nuovi listener o interventi systemd.

## 1. OpenClaw Gateway

- Componente: OpenClaw Gateway
- Metodo: HTTP `GET`
- Endpoint osservato: `http://127.0.0.1:18789/health`
- Binding: loopback locale `127.0.0.1`, porta `18789`
- Esempio di risposta redatto:

```json
{"ok":true,"status":"live"}
```

- Autenticazione: non documentata nell'evidenza ricevuta
- Versione: non restituita nell'esempio ricevuto
- Compatibilità R1: dopo la normalizzazione di `live`, lo snapshot classifica il componente come `healthy`
- Esposizione pubblica: non indicata; il binding dichiarato è esclusivamente loopback

Verifica dichiarata da UNO: richiesta HTTP locale al percorso `/health` con risposta JSON valida. Il report ricevuto non include ancora transcript completo del comando, timestamp del test o intestazioni HTTP.

## 2. Nodo GPU

- Nodo Tailscale dichiarato: `100.95.209.126`
- Ruolo autorevole del nodo: workload GPU con 2 NVIDIA L4 da 24 GB

### vLLM

- Porta verificata: `8000`
- Esito dichiarato: connection refused o timeout
- Endpoint health JSON utilizzabile: non rilevato
- Autenticazione: non applicabile allo stato osservato
- Versione: non rilevata

### Ollama

- Metodo: HTTP `GET`
- Endpoint osservato: `http://100.95.209.126:11434/api/version`
- Binding: indirizzo Tailscale/CGNAT del nodo, porta `11434`
- Esempio di risposta redatto:

```json
{"version":"<redacted>"}
```

- Autenticazione: non documentata nell'evidenza ricevuta
- Compatibilità R1: la risposta non contiene `status`; l'adapter generico restituisce quindi `unknown`
- Limite: questo endpoint dimostra la raggiungibilità di Ollama, non lo stato delle due GPU, la VRAM, la temperatura o i workload attivi

L'endpoint root `/` restituisce testo semplice e non è compatibile con il contratto JSON dell'osservabilità R1.

## 3. PM2 sul nodo orchestratore

- Processo di interesse: `pianodivino-ui`
- Interfaccia HTTP nativa rilevata: nessuna
- Listener aggiuntivi rilevati per PM2: nessuno dichiarato
- Autenticazione: non applicabile
- Versione PM2: non riportata nell'evidenza ricevuta
- Stato R1 previsto: `unavailable / NOT_CONFIGURED`

PM2 non deve essere esposto tramite un pacchetto HTTP generico. L'ispezione futura deve passare dal DUE Action Broker locale, con API PM2 programmatica, allowlist e Unix Domain Socket.

## 4. Decisioni tecniche

1. OpenClaw è la prima sorgente health già materializzabile, ma l'attivazione dell'endpoint DUE resta subordinata a una fase operativa separata.
2. Ollama `/api/version` può essere usato soltanto come evidenza di runtime/versione, non come inventario GPU.
3. PM2 richiede il DUE Action Broker.
4. Il nodo GPU richiede un adapter dedicato o il DUE Action Broker per produrre uno snapshot tipizzato delle due L4.
5. Nessuna delle URL deve essere resa pubblica tramite Nginx.

## 5. Limiti dell'evidenza

L'inventario è sufficiente per definire l'architettura successiva, ma non costituisce ancora prova di produzione completa. Mancano:

- transcript dei comandi di verifica;
- timestamp per ogni controllo;
- versioni reali di OpenClaw e PM2;
- conferma esplicita dell'eventuale autenticazione di OpenClaw e Ollama;
- output redatto di binding e processi in ascolto;
- verifica ripetibile dello stato delle due GPU.

Questi elementi saranno richiesti nella PR operativa R2 prima di qualsiasi materializzazione sulle VPS.

## 6. Stato

- Inventario read-only: completato con limiti documentati
- Modifiche VPS durante l'inventario: nessuna dichiarata
- R1 software: candidabile al merge dopo CI verde
- Materializzazione VPS: non autorizzata da questo report
