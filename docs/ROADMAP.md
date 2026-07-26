# DUE Workstation — Roadmap di ripartenza

## FASE R0 — Fondazione e igiene repository

Obiettivo: rendere il repository una fonte affidabile.

Deliverable:

- stato autorevole del progetto;
- roadmap versionata;
- `.gitignore` ricorsivo;
- CI minima per frontend;
- template PR e checklist anti-artefatti;
- nessuna modifica alle VPS.

Criterio di uscita:

- PR con meno di 10 file pertinenti;
- build frontend riproducibile;
- nessun file generato o segreto;
- merge manuale approvato da Zava.

## FASE R1 — Osservabilità read-only

Obiettivo: sostituire i primi dati simulati con dati reali senza introdurre comandi mutativi.

Perimetro iniziale:

- stato PM2 di `pianodivino-ui`;
- health applicativo;
- stato OpenClaw;
- inventario GPU del nodo `136.117.92.228`;
- timestamp e origine di ogni dato.

Architettura:

- contratti TypeScript condivisi;
- adapter server-side read-only;
- nessuna shell arbitraria;
- nessuna porta pubblica aggiuntiva;
- audit strutturato;
- timeout e fallback espliciti.

Criterio di uscita:

- test unitari e integrazione;
- CI verde;
- dati reali identificabili nella UI;
- comportamento degradato chiaro quando un servizio non risponde;
- zero downtime.

## FASE R2 — Action Broker minimo

Obiettivo: introdurre un canale locale tipizzato per azioni amministrative osservabili.

Primo comando ammesso:

- `service.inspect` sul solo target `pianodivino-ui`.

Vincoli:

- Unix Domain Socket;
- nessun TCP listener;
- allowlist stretta;
- risposte validate;
- audit journald in JSON;
- systemd soltanto dopo review e approvazione esplicita;
- rollback verificato.

## FASE R3 — Terminale e identità

Obiettivo: eliminare la simulazione e definire accesso, ruoli e conferme.

- terminale legacy fail-closed;
- autenticazione reale;
- ruoli Zava, UNO e amministratori autorizzati;
- separazione tra lettura, proposta e azione;
- conferma per operazioni esterne o distruttive;
- log completi senza segreti.

## FASE R4 — Memoria, ricerca e portachiavi

- Mem0 e Graphiti dietro un unico Memory Steward;
- PostgreSQL/pgvector come persistenza verificabile;
- SearXNG e browser isolato;
- OpenBao per credenziali e token;
- nessun segreto trasferito nei prompt o nei log.

## FASE R5 — Orchestrazione agenti

- DUE Core;
- GitHub Manager;
- Web Scout;
- Memory Steward;
- Security Guard;
- creazione e configurazione agenti dalla UI;
- code lavori, retry controllati e osservabilità.

## FASE R6 — Modelli e media

- routing dei modelli tra nodo orchestratore e nodo GPU;
- rilevamento reale delle due NVIDIA L4;
- gestione modelli locali senza API a pagamento;
- immagini, video e audio come moduli separati;
- limiti VRAM consapevoli della frammentazione 24 GB + 24 GB.

## FASE R7 — Packaging workstation

Solo dopo stabilità della Web App:

- Tauri o shell desktop equivalente;
- installer e aggiornamenti;
- profili hardware differenti;
- valutazione di una distribuzione Linux DUE dedicata.

## Sequenza obbligatoria

Ogni fase segue questo flusso:

`branch pulito → commit progressivi → Draft PR → CI → review → test VPS autorizzato → report → GO/NO-GO → merge manuale`

Nessuna fase può dichiararsi completa basandosi esclusivamente su un messaggio dell'agente o su una CI verde: il diff, i test e lo stato operativo devono essere verificati separatamente.
