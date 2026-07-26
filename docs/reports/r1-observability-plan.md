# FASE R1 — Osservabilità read-only

Data: 26 luglio 2026
Branch: `feat/r1-observability-readonly`

## Obiettivo

Sostituire progressivamente i primi valori simulati della Web App DUE con osservazioni reali, senza introdurre comandi mutativi, shell arbitraria, nuove porte pubbliche o modifiche automatiche alle VPS.

OpenClaw è un componente centrale della FASE R1 e deve essere osservato insieme a PM2, frontend e nodo GPU.

## Primo incremento

Il primo incremento introduce:

- contratto TypeScript comune;
- endpoint `GET /api/observability`;
- health reale del runtime frontend;
- adapter HTTP read-only per PM2, OpenClaw e GPU;
- timeout di 1,5 secondi;
- assenza di cache;
- risposta chiusa e dichiaratamente `unavailable` quando una sorgente non è configurata;
- nessuna restituzione del payload remoto integrale;
- nessun token o credenziale nel risultato.

## Variabili previste

- `DUE_PM2_HEALTH_URL`
- `DUE_OPENCLAW_HEALTH_URL`
- `DUE_GPU_HEALTH_URL`
- `DUE_OBSERVABILITY_ALLOWED_HOSTS`
- `DUE_BUILD_SHA`

Le URL devono usare HTTP(S), non possono contenere credenziali incorporate e devono puntare a loopback, rete privata o host esplicitamente autorizzati.

## Stato iniziale previsto

Senza configurazione VPS:

- frontend: `healthy`, con runtime, uptime e build SHA quando disponibile;
- PM2: `unavailable / NOT_CONFIGURED`;
- OpenClaw: `unavailable / NOT_CONFIGURED`;
- GPU: `unavailable / NOT_CONFIGURED`.

Questo comportamento è intenzionale: la UI non deve presentare dati simulati come reali.

## Passo VPS successivo, non ancora autorizzato

UNO dovrà individuare o predisporre esclusivamente interfacce health read-only per:

1. processo PM2 `pianodivino-ui`;
2. runtime OpenClaw, versione, agenti e code;
3. inventario delle due NVIDIA L4 sul nodo GPU;
4. eventuale autenticazione interna senza esporre segreti alla Web App.

Qualunque intervento VPS dovrà essere documentato con stato precedente, comando, stato successivo, verifica e rollback. Nessun systemd o listener pubblico è autorizzato da questo incremento.

## Criteri GO

- branch derivato dal `master` aggiornato;
- meno di 15 file modificati;
- lint, build e test verdi;
- endpoint read-only;
- nessun `child_process`, `exec`, PM2 mutativo o comando GPU;
- nessun payload remoto non validato restituito al client;
- nessuna modifica alle VPS.
