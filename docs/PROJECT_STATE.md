# DUE Workstation — Stato autorevole del progetto

Data di riferimento: 26 luglio 2026
Branch di ripartenza: `restart/due-foundation-2026-07-26`

## 1. Obiettivo

DUE è una workstation AI privata, multi-agente e amministrabile, con interfaccia web oggi e possibile distribuzione desktop/Linux dedicata in una fase successiva.

L'obiettivo immediato non è costruire un sistema operativo completo, ma rendere reale e osservabile la Web App esistente collegandola progressivamente ai servizi già presenti sulle VPS.

## 2. Stato reale del repository

Il branch `master` contiene un prototipo frontend realizzato con React, Next/Vinext e Vite. Le schermate rappresentano Chat, Agenti, Studio, Memoria, Browser, Terminale, Plugin, Tailscale, GitHub, Portachiavi, Modelli, Lavori, Sicurezza e Preferenze.

I dati mostrati nella UI sono attualmente dimostrativi. Valori GPU, agenti, job, memoria, stato dei servizi e comandi del terminale non devono essere considerati dati reali di produzione.

Il repository non contiene ancora un backend DUE completo né integrazioni operative affidabili con PM2, OpenClaw, GPU, Mem0, Graphiti, OpenBao, GitHub o Tailscale.

## 3. Infrastruttura autorevole

### Nodo GPU

- IP: `136.117.92.228`
- GPU: 2 × NVIDIA L4 da 24 GB
- VRAM totale fisica: 48 GB, frammentata tra due GPU
- Ruolo: inferenza e workload GPU

### Nodo orchestratore e frontend

- IP: `34.9.150.177`
- Dominio: `ai.pianodivino.com`
- Runtime: Node.js 22
- Processo frontend: PM2 + Nginx
- Servizi presenti: OpenClaw, Mem0, Graphiti, PostgreSQL, Redis, SearXNG, OpenBao
- Ruolo: interfaccia web, orchestrazione, memoria, ricerca e servizi applicativi

Qualunque riferimento nel prototipo a RTX PRO 6000, g4-standard-48 o 96 GB di VRAM è materiale UI simulato e non descrive l'infrastruttura attuale.

## 4. Modello di autorità

- Zava è il proprietario e approva merge, cambi di fase e azioni esterne rilevanti.
- UNO mantiene piena autorità amministrativa sulle VPS, incluso sudo/root.
- L'Action Broker è un'interfaccia operativa tipizzata, osservabile e auditabile. Non è una barriera di sicurezza contro UNO.
- Le azioni distruttive o con impatto esterno devono avere rollback documentato e prova verificabile.

## 5. Stato sicurezza e deploy

- Nessun nuovo servizio della FASE 1A è considerato approvato o installato sulla base del lavoro della PR #1.
- La PR #1 è stata chiusa senza merge perché contaminata da dipendenze, build artefacts e modifiche estranee.
- Il solo punto di partenza valido è `master` al commit `21cd7f3712faacac9414a061e394d9176fbd13cf`.
- Prima di installare systemd o modificare la produzione devono esistere una PR pulita, test eseguiti, CI verde, procedura di verifica e rollback.

## 6. Regole repository

- Un branch per ogni fase o funzione.
- Nessun push diretto su `master`.
- Nessun `node_modules`, `dist`, `.next`, cache, log, output o segreto nel repository.
- Ogni PR deve contenere solo file pertinenti al proprio obiettivo.
- I report operativi devono stare in `docs/reports/`.
- Le modifiche eseguite soltanto sulla VPS devono essere documentate con comando, stato precedente, stato successivo, verifica e rollback.
- Nessun merge automatico.

## 7. Decisione di ripartenza

Il progetto riparte separando nettamente:

1. documentazione e governance;
2. osservabilità read-only;
3. collegamento della UI ai dati reali;
4. azioni operative controllate;
5. memoria, browser, agenti e media;
6. eventuale packaging desktop o sistema operativo dedicato.

Il primo codice operativo da realizzare sarà una integrazione read-only minima, testabile e priva di effetti sulla produzione.
