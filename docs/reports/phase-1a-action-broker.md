# Report Tecnico FASE 1A: DUE Action Broker

**Obiettivo:**
Implementazione del DUE Action Broker come demone indipendente per standardizzare le azioni di sistema, garantendo l'esecuzione controllata, la registrazione (audit strutturato) e l'interfaccia via Unix Domain Socket, mantenendo inalterati i privilegi di amministrazione diretti (Dual-Path Policy).

**Architettura Implementata:**
- **Servizio:** Fastify in ascolto esclusivamente su Unix Domain Socket (`/run/due-action-broker/broker.sock`) con permessi 0660 per la massima sicurezza locale.
- **Validazione:** Utilizzo di Zod per contrattualizzare payload di richiesta e risposta. È presente un'allowlist stretta.
- **Azioni consentite (Broker):** `service.inspect` verso `pianodivino-ui`. Tutte le azioni mutative sono rifiutate.
- **Isolamento:** Nessun utilizzo di `child_process.exec`. Le informazioni sui servizi sono ottenute tramite l'API programmatica di `pm2`.
- **Systemd:** Unità `.socket` e `.service` configurate con hardening (`ProtectSystem=full`, `NoNewPrivileges=true`).
- **Audit:** Ogni richiesta loggata su `stdout` (journald) con struttura JSON dettagliata.
- **Terminale Legacy:** Escluso temporaneamente dalla PR per non inquinare la fase 1A finché non sarà sviluppato un meccanismo di security (CSRF/JWT) a prova di audit.
- **CI:** Inclusa una Github Action base (`.github/workflows/broker-ci.yml`) per eseguire installazione, typecheck e unit test sul pacchetto broker, senza runbare servizi.

**File Creati:**
- `packages/action-contracts/index.ts`
- `packages/action-contracts/responses.ts`
- `services/due-action-broker/package.json`
- `services/due-action-broker/tsconfig.json`
- `services/due-action-broker/due-action-broker.socket`
- `services/due-action-broker/due-action-broker.service`
- `services/due-action-broker/src/index.ts`
- `tests/action-broker/broker.test.ts`
- `docs/reports/phase-1a-action-broker.md`
- `.github/workflows/broker-ci.yml`

**Comandi Eseguiti:**
- Check del perimetro di rete (`iptables -L`, analisi porte container) per garantire l'isolamento (tutte protette dal firewall VPC).
- Scansione `.env` e repository (nessuna credenziale esposta, rimossi i lock e moduli per CI).
- Compilazione e validazione locale dei contratti TypeScript.
