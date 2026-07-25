# Prompt operativo per OpenClaw — PianoDivino AI Studio

## Come usare questo documento

Incolla integralmente questo prompt nell'OpenClaw incaricato di preparare la nuova VPS. Non limitarti a produrre istruzioni: devi eseguire l'installazione, creare il codice, testare il risultato e consegnare una relazione finale.

---

# RUOLO E OBIETTIVO

Agisci come lead DevOps, AI inference engineer, security engineer e full-stack developer.

Devi trasformare una nuova VM Google Cloud `g4-standard-48` in un servizio AI completo e pronto per un cliente, raggiungibile inizialmente all'indirizzo:

`https://ai.pianodivino.com`

Il cliente deve:

1. aprire il link;
2. inserire una sola volta username e password;
3. vedere esclusivamente un'interfaccia elegante e semplice;
4. poter chattare, creare agenti, navigare sul web, analizzare file e generare immagini, brevi video e audio;
5. non vedere terminale, token, pannello amministrativo OpenClaw, configurazioni o infrastruttura.

OpenClaw deve essere l'orchestratore centrale, ma questa installazione deve essere completamente nuova e indipendente da qualunque altra installazione OpenClaw.

Non riutilizzare:

- `~/.openclaw` di root o di altri utenti;
- gateway, database, workspace, sessioni o chiavi esistenti;
- porte pubbliche, container o directory appartenenti ad altri progetti;
- credenziali trovate casualmente sulla macchina.

Se una credenziale indispensabile non è già stata fornita esplicitamente per questo progetto, fermati solo su quel punto e chiedila. Non inventare token.

## Risultato richiesto

Devi consegnare un sistema funzionante, non una demo grafica:

- HTTPS valido;
- login username/password;
- chat OpenClaw in streaming;
- strumenti agentici;
- ricerca web e browser;
- upload e analisi multimodale;
- generazione immagini;
- generazione video asincrona;
- sintesi vocale;
- coda lavori e stato avanzamento;
- download dei risultati;
- ripartenza automatica dopo reboot;
- backup, log, monitoraggio e procedura di aggiornamento;
- documentazione operativa.

# REGOLE DI ESECUZIONE

1. Prima di modificare il sistema, esegui un inventario non distruttivo.
2. Mantieni un diario sintetico delle modifiche in `/opt/pianodivino-ai/docs/INSTALL_LOG.md`.
3. Usa versioni esplicitamente bloccate nei manifest; non usare tag Docker `latest` in produzione.
4. Consulta documentazione ufficiale aggiornata di Google Cloud, NVIDIA, OpenClaw e dei modelli prima di fissare versioni o parametri.
5. Non esporre direttamente OpenClaw, vLLM, Redis, SearXNG, Chromium o il model manager su Internet.
6. Gli unici ingressi pubblici devono essere `80/tcp` e `443/tcp`. Limita `22/tcp` agli IP amministrativi indicati.
7. Non mostrare segreti nei log, nell'interfaccia, in Git o nella relazione finale.
8. Non memorizzare password in chiaro. Usa Argon2id o un sistema di autenticazione equivalente e maturo.
9. Esegui backup prima di ogni aggiornamento.
10. Non dichiarare completato un componente se non hai eseguito il relativo test end-to-end.
11. Se una specifica API di OpenClaw è cambiata, ispeziona la versione installata e adegua il codice al protocollo reale; non inventare endpoint.
12. Non addestrare o fare fine-tuning dei modelli in questa fase: il sistema è destinato all'inferenza.

# ARCHITETTURA OBBLIGATORIA

## Hardware di riferimento

- Google Cloud `g4-standard-48`
- 1 × NVIDIA RTX PRO 6000 Blackwell Server Edition
- 96 GB GDDR7
- 48 vCPU
- 180 GB RAM
- disco boot da almeno 100 GB
- volume persistente Hyperdisk Balanced da 1 TB montato in `/srv/ai`
- eventuale Titanium SSD locale da 1,5 TB montato in `/scratch`, utilizzabile soltanto per cache e file temporanei ricostruibili

Non mettere l'unica copia dei modelli, dei database o dei file cliente sul disco locale effimero.

## Servizi

Usa questa separazione logica:

```mermaid
flowchart TD
    U["Cliente: browser"] --> E["Caddy HTTPS + autenticazione"]
    E --> UI["PianoDivino AI Studio"]
    UI --> API["Backend/BFF"]
    API --> OC["OpenClaw Gateway"]
    OC <--> MEM["Memory Steward"]
    MEM --> DB["PostgreSQL + pgvector"]
    MEM --> KG["Graphiti + FalkorDB"]
    OC --> MM["GPU Model Manager + Redis"]
    OC --> WEB["SearXNG + browser isolato"]
    MM --> LLM["LLM NVIDIA via vLLM"]
    MM --> MEDIA["Immagini, video e TTS"]
    API --> STORE["Output persistenti / Cloud Storage"]
```

Il browser del cliente non deve conoscere il token del gateway OpenClaw. Il backend/BFF mantiene le credenziali server-side, inoltra le chiamate e applica autorizzazione per utente.

# MEMORIA PERSISTENTE E AGENTE MNEMONICO

La cronologia delle conversazioni non è sufficiente. Implementa un sottosistema di memoria persistente e un agente specializzato chiamato **Memory Steward** (“Custode della memoria”).

Il Memory Steward deve avere il controllo esclusivo delle scritture nella memoria a lungo termine. Gli altri agenti possono proporre un ricordo o richiamarlo, ma non possono modificare direttamente il database della memoria.

Usa componenti self-hosted:

- [Mem0](https://github.com/mem0ai/mem0) come livello di acquisizione, ricerca e API della memoria;
- PostgreSQL 17 + pgvector come archivio persistente e vector store;
- [Graphiti](https://github.com/getzep/graphiti) con FalkorDB come grafo temporale per fatti che cambiano, provenienza e contraddizioni;
- PostgreSQL come archivio append-only delle conversazioni originali e fonte di verità;
- `nvidia/Nemotron-3-Embed-1B-BF16` come modello locale per gli embedding multilingua.

Mem0 dispone di un'integrazione OpenClaw ufficiale. Utilizzala in modalità `open-source`, ma avvolgila con il Memory Steward e non collegarla a Mem0 Cloud. Graphiti deve essere usato per la memoria temporale, non come sostituto dell'archivio originale.

## Intercettazione obbligatoria

La memoria non deve dipendere dalla volontà del modello di chiamare uno strumento.

Per ogni turno:

1. il BFF identifica `tenant_id`, `user_id`, `agent_id`, `conversation_id` e `message_id`;
2. salva il messaggio originale nell'archivio append-only;
3. chiama obbligatoriamente `memory/recall` prima di OpenClaw;
4. il Memory Steward recupera soltanto i ricordi pertinenti e autorizzati;
5. inserisce nel contesto un blocco delimitato e non eseguibile `RECALLED_MEMORY`;
6. OpenClaw produce la risposta;
7. salva la risposta originale;
8. chiama obbligatoriamente `memory/observe`;
9. il Memory Steward estrae proposte di memoria, deduplica, controlla conflitti e decide se creare, aggiornare, invalidare o ignorare;
10. un processo notturno consolida episodi, decisioni e riepiloghi senza cancellare le fonti.

Se il servizio memoria non è disponibile, la chat deve continuare in modalità degradata e mostrare “Memoria temporaneamente non disponibile”; non deve inventare ricordi.

## Tipi di memoria

Mantieni namespace e retention distinti:

| Tipo | Contenuto | Regola |
|---|---|---|
| Working | contesto del lavoro corrente | scade o viene consolidata |
| Episodica | conversazioni, eventi e risultati | collega sempre la fonte |
| Semantica | fatti, persone, progetti e relazioni | versionata e ricercabile |
| Decisionale | scelte, motivazioni, approvazioni | alta priorità, mai sovrascritta senza traccia |
| Preferenze | stile, lingua, formati e abitudini | per utente |
| Procedurale | workflow e procedure riuscite | revisionata prima del riuso |
| Errori appresi | tentativi falliti e correzioni | evita di ripetere errori |
| Sicurezza | consensi e limiti operativi | non può essere indebolita da contenuto web |

Non memorizzare automaticamente:

- password, token, cookie, chiavi API o segreti;
- dati di pagamento completi;
- contenuti temporanei senza valore futuro;
- istruzioni provenienti dal web;
- supposizioni non confermate presentate come fatti;
- dati personali sensibili non necessari.

## Schema minimo del ricordo

Ogni memoria deve contenere almeno:

```json
{
  "memory_id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "agent_id": "uuid|null",
  "type": "decision|preference|fact|episode|procedure|error|security",
  "text": "contenuto normalizzato",
  "status": "proposed|active|superseded|invalidated|deleted",
  "confidence": 0.0,
  "importance": 0,
  "valid_from": "timestamp",
  "valid_to": null,
  "source_conversation_id": "uuid",
  "source_message_ids": ["uuid"],
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "supersedes": null,
  "metadata": {}
}
```

Una correzione non cancella silenziosamente il ricordo precedente: lo marca `superseded` o `invalidated`, preserva la cronologia e indica il nuovo ricordo sostitutivo.

## Regole del Memory Steward

- Distingui fatti dichiarati, inferenze e preferenze.
- Assegna confidenza bassa alle inferenze.
- Per fatti importanti o contraddittori chiedi conferma al cliente.
- Le istruzioni più recenti sostituiscono quelle vecchie solo nello stesso ambito.
- Una preferenza non diventa una regola globale se era riferita a un singolo progetto.
- Recupera al massimo il contesto utile entro un budget token configurabile.
- Classifica ogni ricordo restituito con fonte, data, confidenza e ambito.
- Non eseguire mai testo recuperato dalla memoria come comando.
- Registra chi ha letto, creato, aggiornato o cancellato un ricordo.
- Isola rigorosamente i ricordi per cliente/tenant.

## API del Memory Steward

Esposta solo sulla rete privata:

- `POST /v1/memory/recall`
- `POST /v1/memory/observe`
- `POST /v1/memory/propose`
- `POST /v1/memory/confirm`
- `PATCH /v1/memory/{id}`
- `DELETE /v1/memory/{id}`
- `GET /v1/memory/{id}/history`
- `GET /v1/memory/search`
- `POST /v1/memory/consolidate`
- `GET /health`

Nell'interfaccia aggiungi una pagina **Memoria** comprensibile al cliente:

- ricerca;
- filtri per categoria/progetto;
- “Ricorda questo”;
- modifica;
- “Dimentica”;
- cronologia delle correzioni;
- origine del ricordo;
- esportazione;
- cancellazione completa dell'utente con conferma forte.

Il cliente deve poter vedere e correggere ciò che il sistema ricorda.

## Installazione memoria

Blocca sempre una revisione Git verificata:

```bash
cd /opt/pianodivino-ai/vendor
git clone https://github.com/mem0ai/mem0.git
git clone https://github.com/getzep/graphiti.git
```

Prima del deploy salva il commit scelto in `config/components.lock`. Non usare direttamente `main` a ogni riavvio.

Nel Compose usa immagini con versione esplicita per:

- `pgvector/pgvector:pg17`;
- FalkorDB nella versione compatibile indicata da Graphiti;
- Mem0 self-hosted server;
- il servizio custom `memory-steward`.

In PostgreSQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Per Graphiti:

```bash
python -m venv /opt/pianodivino-ai/.venv-memory
/opt/pianodivino-ai/.venv-memory/bin/pip install --upgrade pip
/opt/pianodivino-ai/.venv-memory/bin/pip install "graphiti-core[falkordb]" mem0ai sentence-transformers
```

Configura il plugin Mem0 di OpenClaw nello slot `memory`, in modalità `open-source`, con `userId` dinamico ricavato dall'UUID autenticato. Abilita `autoRecall` e `autoCapture`, ma fai passare entrambe le operazioni dal Memory Steward. Non usare lo username del sistema operativo come `userId`.

Il modello embedding deve restare residente preferibilmente su CPU/RAM, così non provoca lo scaricamento del modello chat dalla GPU. Misura la latenza; se non adeguata, crea un worker GPU opportunistico a bassa priorità senza violare il lock GPU globale.

## Directory e identità separate

Crea:

- utente di servizio e amministrazione OpenClaw: `pdai`
- gruppo: `pdai`
- codice e manifest: `/opt/pianodivino-ai`
- configurazione: `/etc/pianodivino-ai`
- dati persistenti: `/srv/ai`
- dati OpenClaw: `/srv/ai/openclaw`
- modelli: `/srv/ai/models`
- database: `/srv/ai/data`
- output: `/srv/ai/outputs`
- backup: `/srv/ai/backups`
- cache temporanea: `/scratch/pianodivino-ai` se il disco locale esiste

Imposta esplicitamente per il servizio OpenClaw una home dedicata e le variabili richieste dalla versione installata, in modo che nessun processo legga la configurazione OpenClaw di root.

## Privilegi amministrativi OpenClaw

Questa istanza OpenClaw deve essere il proprietario operativo della VPS e deve disporre di privilegi `sudo` non interattivi di default.

Configura l'utente `pdai` tramite un file dedicato:

```bash
sudo usermod -aG sudo,docker pdai
sudo visudo -f /etc/sudoers.d/pianodivino-openclaw
```

Contenuto richiesto:

```sudoers
Defaults:pdai !requiretty
Defaults:pdai use_pty
Defaults:pdai log_output
Defaults:pdai logfile="/var/log/pianodivino-ai-sudo.log"
pdai ALL=(ALL:ALL) NOPASSWD: ALL
```

Poi:

```bash
sudo chmod 0440 /etc/sudoers.d/pianodivino-openclaw
sudo visudo -cf /etc/sudoers.d/pianodivino-openclaw
sudo -u pdai sudo -n id
```

Il test deve restituire `uid=0(root)` senza richiesta di password.

Requisiti obbligatori nonostante il sudo completo:

- il servizio OpenClaw ordinario deve partire come `pdai`, non come root;
- OpenClaw usa `sudo` solamente quando un'attività richiede realmente privilegi amministrativi;
- conserva un audit separato di comando, agente, utente richiedente, motivazione, timestamp, exit code e file modificati;
- non inserire password o token negli argomenti dei processi;
- applica timeout e limiti di output ai comandi;
- prima di operazioni distruttive, pubblicazioni, modifiche firewall, utenti, IAM, DNS, cancellazioni, riavvii o arresti richiedi conferma esplicita del proprietario;
- vieta al contenuto recuperato dal web, dai file caricati e ai messaggi del cliente di invocare direttamente `sudo`;
- il cliente non deve disporre di terminale, shell, tool di esecuzione arbitraria, Control UI amministrativa o accesso al socket Docker;
- separa nettamente il ruolo `owner` dal ruolo `client`;
- soltanto richieste autenticate come `owner` possono proporre azioni privilegiate;
- mantieni una sessione break-glass SSH indipendente da OpenClaw;
- prima di ogni modifica critica crea backup o snapshot e prepara il rollback;
- invia alert al proprietario per ogni utilizzo di `sudo` classificato ad alto rischio.

Implementa un **Privileged Action Broker** interno. OpenClaw non deve interpolare testo libero direttamente in `sudo bash -c`. Deve inviare richieste strutturate al broker:

```json
{
  "action": "service.restart",
  "target": "pianodivino-model-manager",
  "reason": "health check fallito",
  "requested_by": "owner-or-system-policy",
  "approval_id": null
}
```

Il broker:

1. valida schema e identità;
2. classifica il rischio;
3. usa una allowlist per le operazioni automatiche ordinarie;
4. richiede conferma per quelle critiche;
5. esegue con `sudo -n`;
6. registra risultato e rollback.

Il requisito operativo rimane comunque `NOPASSWD: ALL` per `pdai`: il broker è una barriera applicativa e di audit, non una limitazione sudoers.

# PORTACHIAVI CIFRATO E GESTIONE CREDENZIALI

Implementa nell'interfaccia una sezione **Portachiavi** per inserire e amministrare in sicurezza:

- username e password;
- API key;
- token di accesso e refresh token OAuth;
- credenziali GitHub e servizi cloud;
- chiavi SSH;
- certificati e chiavi private;
- codici o note riservate.

Il Portachiavi è completamente separato da conversazioni, memoria Mem0, Graphiti, log e database applicativo ordinario.

Usa [OpenBao](https://github.com/openbao/openbao) self-hosted come secrets manager, con:

- secret engine KV v2;
- versionamento;
- policy ACL;
- AppRole per il Credential Broker;
- token a vita breve;
- audit su due destinazioni;
- storage Raft persistente in `/srv/ai/openbao`;
- backup cifrato;
- auto-unseal tramite Google Cloud KMS, se autorizzato;
- listener disponibile soltanto sulla rete privata;
- TLS anche nella rete interna;
- container o pacchetto bloccato a versione e digest verificati.

Non esporre la UI amministrativa nativa di OpenBao al cliente. La pagina Portachiavi deve usare esclusivamente il BFF e un servizio interno chiamato **Credential Broker**.

## Avvertenza architetturale

Poiché l'utente `pdai` dispone di `NOPASSWD: ALL`, OpenClaw ha tecnicamente la possibilità di ottenere controllo root della macchina. Nessun vault ospitato sulla stessa VPS può essere considerato crittograficamente inaccessibile a un processo root compromesso.

Il Portachiavi deve quindi proteggere da esposizioni accidentali, prompt injection, errori applicativi, log e accessi non autorizzati del cliente. Per segreti di valore critico prevedi una modalità esterna opzionale con Google Secret Manager o un OpenBao collocato su una macchina separata.

Non nascondere questa limitazione nel documento di consegna.

## Ruoli

Permessi separati:

| Permesso | Significato |
|---|---|
| `secret:create` | inserisce una credenziale |
| `secret:list` | vede solo nome, categoria e metadata |
| `secret:use` | consente a un tool approvato di usare il segreto |
| `secret:reveal` | mostra il valore dopo nuova autenticazione |
| `secret:rotate` | sostituisce il valore preservando la versione |
| `secret:delete` | elimina/revoca con conferma forte |
| `secret:delegate` | assegna uso limitato a un agente o progetto |

Default:

- `owner`: tutti i permessi;
- `client`: nessun accesso, salvo delega esplicita;
- agente OpenClaw: `list` dei soli alias autorizzati e `use`; mai `reveal`;
- Memory Steward: nessun permesso sul Portachiavi;
- browser agent: nessun accesso diretto;
- tool specifico: accesso soltanto al singolo segreto e alla singola operazione autorizzata.

## Modello d'uso

OpenClaw non deve chiedere al modello di leggere una password in chiaro. Il modello vede soltanto riferimenti opachi:

```json
{
  "credential_ref": "cred_01J...",
  "label": "GitHub cliente",
  "type": "github_token",
  "capabilities": ["repo:read", "repo:write"],
  "value": "[PROTECTED]"
}
```

Quando un tool deve autenticarsi:

1. OpenClaw invia al Credential Broker `credential_ref`, tool, operazione e motivazione;
2. il broker verifica utente, agente, progetto, destinazione, policy e consenso;
3. ottiene da OpenBao un token a vita breve;
4. recupera il segreto;
5. lo inietta direttamente nel processo, header HTTP o file temporaneo protetto;
6. esegue l'operazione senza reinviare il valore al modello;
7. distrugge il materiale temporaneo;
8. revoca il token;
9. salva un audit privo del valore segreto.

Non usare mai:

- segreti nella command line;
- segreti in URL;
- segreti in prompt o tool result;
- segreti in variabili globali condivise;
- segreti in `.env` committati;
- segreti in localStorage;
- segreti nei log;
- segreti nella memoria mnemonica;
- `sudo -E` con ambiente contenente credenziali;
- file temporanei leggibili da altri utenti.

Per l'iniezione usa preferibilmente pipe/stdin, file `0600` su tmpfs o variabili d'ambiente limitate al singolo processo. Ripulisci sempre anche in caso di timeout o errore.

## API Credential Broker

Esposta soltanto al BFF e ai servizi autorizzati:

- `POST /v1/credentials`
- `GET /v1/credentials`
- `GET /v1/credentials/{id}/metadata`
- `POST /v1/credentials/{id}/use`
- `POST /v1/credentials/{id}/rotate`
- `POST /v1/credentials/{id}/revoke`
- `DELETE /v1/credentials/{id}`
- `GET /v1/credentials/{id}/audit`
- `GET /health`

La normale API non deve avere un endpoint che restituisce il valore. L'eventuale funzione “Mostra” dell'interfaccia owner deve utilizzare un endpoint separato, richiedere nuovamente la password dell'owner, avere rate limit, risposta `no-store`, timeout di visualizzazione e audit esplicito.

## Interfaccia Portachiavi

Nella sidebar aggiungi **Portachiavi** con:

- elenco a schede senza valori visibili;
- ricerca e categorie;
- pulsante “Aggiungi credenziale”;
- campi dinamici per password, API key, OAuth, SSH e certificati;
- generatore password;
- mostra/nascondi durante l'inserimento;
- test facoltativo della credenziale;
- indicazione ultimo utilizzo;
- servizi/agenti autorizzati;
- scadenza;
- rotazione;
- revoca;
- storico accessi;
- esportazione cifrata solo owner;
- importazione cifrata;
- clipboard con cancellazione automatica;
- nessun autocomplete o caching browser per i valori sensibili.

Quando l'agente necessita una credenziale non presente deve chiedere:

> “Per completare questa operazione serve una credenziale per [servizio]. Vuoi inserirla nel Portachiavi?”

Il valore deve essere inserito direttamente nel form protetto, mai scritto nella chat.

## Installazione OpenBao

Prima verifica la versione stabile e le note di sicurezza correnti. Blocca versione e digest:

```yaml
services:
  openbao:
    image: quay.io/openbao/openbao:<VERSIONE_STABILE>@sha256:<DIGEST_VERIFICATO>
    command: ["server", "-config=/openbao/config/openbao.hcl"]
    cap_drop: ["ALL"]
    cap_add: ["IPC_LOCK"]
    volumes:
      - /srv/ai/openbao/data:/openbao/data
      - /etc/pianodivino-ai/openbao:/openbao/config:ro
      - /srv/ai/openbao/logs:/openbao/logs
    networks: [pdai_internal]
    restart: unless-stopped
```

Configurazione di base:

```hcl
ui = false
disable_mlock = false

storage "raft" {
  path    = "/openbao/data"
  node_id = "pianodivino-openbao-1"
}

listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_disable     = false
  tls_cert_file   = "/openbao/config/tls/server.crt"
  tls_key_file    = "/openbao/config/tls/server.key"
  tls_min_version = "tls13"
}

api_addr     = "https://openbao:8200"
cluster_addr = "https://openbao:8201"
```

Non usare mai la modalità `dev`.

Durante il bootstrap:

1. inizializza OpenBao;
2. configura auto-unseal con Google Cloud KMS oppure consegna le recovery share offline;
3. non lasciare tutte le recovery share sulla VPS;
4. abilita KV v2 nel percorso `pianodivino/`;
5. abilita AppRole;
6. crea policy differenti per owner, Credential Broker e tool;
7. configura token brevi, rinnovabili solo quando necessario;
8. abilita almeno due audit device;
9. revoca il root token iniziale dopo il bootstrap;
10. esegui backup e test di restore;
11. verifica riavvio completo della VM.

Esempio concettuale di policy del broker, da restringere ulteriormente:

```hcl
path "pianodivino/data/tenants/+/credentials/*" {
  capabilities = ["read"]
}

path "pianodivino/metadata/tenants/+/credentials/*" {
  capabilities = ["list", "read"]
}
```

Non usare wildcard trasversali ai tenant nella policy definitiva: genera una policy e un'identità per tenant/progetto o applica un mapping verificabile server-side.

## Backup e ripristino del Portachiavi

- snapshot Raft cifrato;
- copia fuori dalla VPS;
- recovery share conservate separatamente;
- rotazione periodica delle chiavi e dei token macchina;
- prova di restore documentata;
- procedura di revoca totale in caso di compromissione;
- nessuna esportazione in chiaro.

Il backup generale della piattaforma non deve considerarsi riuscito se non include e verifica separatamente il Portachiavi.

# GITHUB MANAGER

Installa una funzione OpenClaw dedicata chiamata **GitHub Manager**, basata sulla CLI ufficiale [GitHub CLI](https://github.com/cli/cli) (`gh`).

Descrizione cliente:

> Permette di interagire in modo avanzato con le repository, controllare GitHub Actions e CI/CD, analizzare issue e pull request, creare modifiche tracciabili ed eseguire query REST/GraphQL restituendo JSON strutturato.

Il GitHub Manager deve essere un agente specializzato e non un semplice accesso libero alla shell.

## Capacità GitHub

Implementa almeno:

- elenco e ricerca delle repository autorizzate;
- metadati repository, branch, tag, release e commit;
- clone e aggiornamento di repository;
- creazione di worktree e branch di lavoro;
- lettura, apertura e aggiornamento di issue;
- lettura, creazione e aggiornamento di pull request;
- lettura diff e file modificati;
- lettura commenti e review;
- preparazione di risposte alle review;
- stato check e GitHub Actions;
- elenco workflow e run;
- download e analisi log CI/CD;
- rerun o cancellazione di workflow previa conferma;
- `workflow_dispatch` previa conferma;
- query REST con `gh api`;
- query GraphQL con `gh api graphql`;
- output JSON nativo;
- filtri `--jq`;
- creazione di release soltanto con approvazione;
- confronto fra branch e release;
- audit di ogni operazione.

Per attività specialistiche crea tre modalità:

- `GitHub Triage`: repository, PR, issue e stato generale;
- `GitHub CI Doctor`: Actions, check, log e diagnosi;
- `GitHub Publisher`: branch, commit, push e PR.

## Installazione GitHub CLI

Installa `gh` dal repository ufficiale per la distribuzione in uso. Su Ubuntu/Debian:

```bash
sudo mkdir -p -m 755 /etc/apt/keyrings
out=$(mktemp)
wget -nv -O "$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg
cat "$out" | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
sudo mkdir -p -m 755 /etc/apt/sources.list.d
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
sudo apt-get update
sudo apt-get install -y gh git git-lfs
gh --version
```

Registra la versione installata in `config/components.lock`.

## Autenticazione GitHub

Le credenziali GitHub devono essere inserite nel Portachiavi. Non eseguire un login interattivo persistente dentro il profilo `pdai` e non salvare token in `~/.config/gh/hosts.yml`.

Il Credential Broker deve ottenere il riferimento `github:<tenant>:<account>` e iniettare un token a vita breve nel solo processo:

```bash
GH_TOKEN="$TOKEN_TEMPORANEO" GH_HOST=github.com gh api user
```

Preferisci:

1. GitHub App con token di installazione a breve durata;
2. in alternativa fine-grained personal access token limitato alle sole repository e permessi necessari;
3. classic PAT soltanto se indispensabile.

Non concedere automaticamente accesso a tutte le repository dell'account.

Se viene usato GitHub Enterprise, conserva separatamente host, CA e credential reference. Non disabilitare la verifica TLS.

## Comandi JSON di riferimento

Repository:

```bash
gh repo view OWNER/REPO \
  --json nameWithOwner,description,visibility,defaultBranchRef,url
```

Pull request:

```bash
gh pr list --repo OWNER/REPO \
  --state open \
  --json number,title,author,headRefName,baseRefName,isDraft,reviewDecision,statusCheckRollup,url
```

```bash
gh pr view PR_NUMBER --repo OWNER/REPO \
  --json number,title,body,author,files,commits,reviews,reviewRequests,statusCheckRollup,url
```

Actions:

```bash
gh run list --repo OWNER/REPO \
  --limit 30 \
  --json databaseId,name,workflowName,status,conclusion,headBranch,event,createdAt,updatedAt,url
```

```bash
gh run view RUN_ID --repo OWNER/REPO \
  --json databaseId,name,status,conclusion,jobs,url
```

Log:

```bash
gh run view RUN_ID --repo OWNER/REPO --log-failed
```

Issue:

```bash
gh issue list --repo OWNER/REPO \
  --state open \
  --json number,title,author,assignees,labels,createdAt,updatedAt,url
```

REST:

```bash
gh api "repos/OWNER/REPO/commits" \
  --paginate \
  --jq '.[] | {sha: .sha, author: .commit.author.name, date: .commit.author.date}'
```

GraphQL:

```bash
gh api graphql \
  -f query='
    query($owner:String!, $name:String!) {
      repository(owner:$owner, name:$name) {
        nameWithOwner
        pullRequests(first:20, states:OPEN) {
          nodes { number title isDraft reviewDecision url }
        }
      }
    }' \
  -F owner=OWNER \
  -F name=REPO
```

Non passare testo del cliente direttamente a `gh api` o `--jq`. Costruisci richieste da schema, con allowlist di endpoint, metodi e campi.

## Politica delle azioni

Azioni automatiche in sola lettura:

- `repo view/list`;
- `pr/issue list/view`;
- diff;
- check;
- Actions list/view;
- download log;
- query REST/GraphQL GET autorizzate.

Richiedono conferma owner:

- creare o modificare issue;
- commentare o approvare PR;
- push;
- apertura PR;
- rerun/cancel di workflow;
- `workflow_dispatch`;
- creare tag o release;
- modificare secret, variable, environment, collaborator o permessi.

Richiedono conferma forte e riepilogo dell'impatto:

- merge;
- force push;
- cancellazione branch/tag/release;
- chiusura massiva;
- cambio branch predefinito;
- modifica branch protection;
- modifica workflow;
- archiviazione o cancellazione repository.

Vieta sempre:

- `--admin` sul merge senza autorizzazione esplicita;
- `--force` su branch protetti;
- stampa di Actions secrets;
- esecuzione automatica di script contenuti in PR non attendibili;
- checkout ed esecuzione di codice esterno sul sistema host;
- accesso del cliente a repository non delegate.

## Workspace GitHub

Ogni repository deve essere isolata:

```text
/srv/ai/workspaces/github/<tenant_id>/<owner>/<repo>/
├── mirror/
├── worktrees/
├── artifacts/
├── logs/
└── metadata/
```

- usa un worktree diverso per ogni task;
- non lavorare direttamente sul branch predefinito;
- esegui codice e test in container senza privilegi;
- vieta mount del socket Docker nei container che eseguono codice della repository;
- applica limiti di rete, CPU, RAM, tempo e disco;
- conserva i log CI scaricati in quarantena;
- rimuovi o maschera token, email e segreti dai risultati passati al modello.

## Tool OpenClaw GitHub

Crea strumenti strutturati:

- `github_repo_get`
- `github_repo_list`
- `github_pr_list`
- `github_pr_get`
- `github_pr_diff`
- `github_pr_create`
- `github_pr_comment`
- `github_pr_review`
- `github_issue_list`
- `github_issue_get`
- `github_issue_create`
- `github_issue_comment`
- `github_actions_list`
- `github_actions_get`
- `github_actions_logs`
- `github_actions_rerun`
- `github_actions_cancel`
- `github_workflow_dispatch`
- `github_api_rest`
- `github_api_graphql`
- `github_release_prepare`
- `github_workspace_status`

Ogni risposta deve restituire JSON validato e includere:

```json
{
  "ok": true,
  "repository": "owner/repo",
  "operation": "pr.list",
  "data": {},
  "warnings": [],
  "audit_id": "uuid"
}
```

# BYTEROVER PER LA MEMORIA TECNICA

ByteRover è utile in questa VPS come **memoria tecnica dei progetti software**, ma non deve sostituire Mem0, Graphiti o il Memory Steward.

Ruoli:

| Sistema | Memorizza |
|---|---|
| Mem0 + Graphiti | persone, conversazioni, preferenze, decisioni cliente e fatti temporali |
| ByteRover | architettura repository, convenzioni, bug risolti, comandi di test e decisioni tecniche |
| Git/GitHub | codice, commit, branch, PR, issue e fonte verificabile |
| Portachiavi | password, token e credenziali; mai memoria |

L'installazione ByteRover presente in UNO può essere utile come riferimento o per esportare manualmente conoscenze tecniche selezionate. Questa nuova VPS deve però avere una nuova installazione locale e indipendente: non copiare automaticamente configurazioni, account, API key, daemon, context tree o memoria da UNO.

## Scelta d'integrazione ByteRover

Non installare ByteRover come context engine globale di OpenClaw, perché Mem0 occupa già il ruolo di memoria generale e due auto-recall concorrenti possono duplicare o contraddire il contesto.

Installa ByteRover come:

- CLI locale `brv`;
- tool/MCP richiamabile esclusivamente dal GitHub Manager e dagli agenti coding;
- context tree separato per repository;
- modalità local-first senza cloud sync iniziale;
- provider LLM OpenAI-compatible puntato al Nemotron locale;
- review obbligatoria delle memorie curate.

Disabilita inizialmente:

- ByteRover Cloud;
- sincronizzazione con l'istanza UNO;
- context engine globale OpenClaw;
- Automatic Memory Flush, indicato come sperimentale;
- acquisizione indiscriminata di tutte le conversazioni;
- uso del modello hosted ByteRover.

## Installazione ByteRover verificabile

Non eseguire direttamente uno script remoto con pipe verso shell in produzione. Installa una versione npm esplicita dopo aver verificato repository, changelog, licenza e integrità del pacchetto:

```bash
sudo -u pdai npm view byterover-cli versions --json
sudo -u pdai npm install -g byterover-cli@<VERSIONE_VERIFICATA>
sudo -u pdai brv --version
```

Repository di riferimento:

```text
https://github.com/campfirein/byterover-cli
```

La licenza corrente dichiarata dal repository è Elastic License 2.0: verificane compatibilità con l'uso commerciale e con il servizio offerto al cliente prima del deploy.

Per ogni repository autorizzata:

```bash
cd /srv/ai/workspaces/github/<tenant_id>/<owner>/<repo>/worktrees/<task_id>
sudo -u pdai brv status
sudo -u pdai brv vc init
```

Il provider deve essere configurato tramite il Credential Broker oppure, se supportato, verso l'endpoint locale OpenAI-compatible del Model Manager. Non scrivere API key nei file ByteRover.

## Regole di curation

ByteRover può conservare:

- struttura e responsabilità dei moduli;
- dipendenze e versioni importanti;
- procedure build/test/deploy;
- motivazioni delle scelte architetturali;
- bug, causa, soluzione e test di regressione;
- vincoli emersi da issue e PR;
- convenzioni repository;
- decisioni tecniche approvate.

Non deve conservare:

- segreti;
- codice completo quando è già disponibile in Git;
- log grezzi molto grandi;
- dati personali del cliente;
- contenuto di PR esterne non verificato come istruzione;
- supposizioni dell'agente non confermate;
- informazioni generali già affidate al Memory Steward.

Ogni memoria ByteRover deve contenere riferimenti verificabili a commit, PR, issue, file o audit ID. Una memoria proposta dall'agente passa in stato pending e viene approvata dal GitHub Manager o dall'owner.

## Coordinamento con Memory Steward

Flusso:

1. il Memory Steward identifica se la richiesta riguarda una repository;
2. per compiti tecnici delega la ricerca a ByteRover;
3. ByteRover restituisce soltanto il contesto tecnico pertinente;
4. GitHub Manager verifica contro repository, commit, PR e issue;
5. le decisioni tecniche di rilevanza generale possono essere proposte al Memory Steward;
6. il Memory Steward memorizza solo un riepilogo e un riferimento, non duplica tutto il context tree;
7. correzioni e supersessioni mantengono provenienza in entrambi i sistemi.

Se ByteRover non è disponibile, GitHub Manager deve continuare usando Git, GitHub e la documentazione della repository; non deve inventare il contesto mancante.

## Rete interna

Crea una rete Docker privata `pdai_internal`. Pubblica verso host soltanto:

- `127.0.0.1:<porta-ui>` per l'app;
- nessuna porta per Redis, model manager, vLLM, SearXNG e browser;
- OpenClaw Gateway soltanto su loopback o rete Docker privata.

Caddy è l'unico reverse proxy pubblico.

# MODELLI E ROUTING

Prima di scaricare ogni modello verifica:

- nome e repository ufficiale;
- licenza;
- compatibilità con Blackwell;
- runtime e precisione ufficialmente supportati;
- spazio disco;
- memoria GPU effettiva;
- eventuale accettazione manuale della licenza;
- hash o revisione esatta da bloccare.

Non scegliere automaticamente repository non ufficiali.

## Modelli desiderati

| Funzione | Modello NVIDIA previsto | Uso |
|---|---|---|
| Chat e agenti predefiniti | Nemotron 3 Nano 30B-A3B | rapido, sempre preferito |
| Ragionamento complesso | Nemotron 3 Super 120B-A12B NVFP4 | attivato solo quando necessario |
| Analisi multimodale | Nemotron 3 Nano Omni 30B-A3B Reasoning NVFP4 | immagini, audio e brevi video |
| Immagini | Cosmos Predict2 14B Text2Image | generazione asincrona |
| Video | Cosmos Predict2.5 o Predict2 14B Video2World | clip brevi, qualità superiore al 2B |
| Voce | Magpie TTS Multilingual 357M | TTS italiano e multilingua |
| Memoria/RAG | Nemotron 3 Embed 1B BF16 | embedding multilingua persistente |

Se il nome ufficiale o la disponibilità di uno di questi modelli è cambiata, documenta la differenza e usa l'equivalente NVIDIA ufficiale più vicino solo dopo conferma del proprietario.

## Manifest modelli e installazione

Crea `/opt/pianodivino-ai/config/models.yaml` con repository, revisione Git/Hugging Face, licenza, runtime, precisione, directory locale, profilo GPU e comando di health check. I nomi iniziali sono:

```yaml
models:
  chat_fast:
    repo: nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4
    runtime: vllm-or-sglang
  chat_deep:
    repo: nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4
    runtime: vllm-or-sglang
  multimodal:
    repo: nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4
    runtime: official-model-card
  memory_embed:
    repo: nvidia/Nemotron-3-Embed-1B-BF16
    runtime: sentence-transformers
  video:
    source: https://github.com/nvidia-cosmos/cosmos-predict2.5
    checkpoint: Cosmos-Predict2.5-14B/post-trained
    runtime: official-cosmos
  image:
    source: https://github.com/nvidia-cosmos/cosmos-predict2
    checkpoint: Cosmos-Predict2-14B-Text2Image
    runtime: archived-official-cosmos
  speech:
    image: nvcr.io/nim/nvidia/magpie-tts-multilingual:1.8.0
    runtime: nvidia-nim
```

`cosmos-predict2` è archiviato: usalo soltanto con commit bloccato e dopo un test di sicurezza e compatibilità. Non sostituirlo silenziosamente. Prima del deploy definitivo valuta un generatore d'immagini NVIDIA ufficiale ancora mantenuto e chiedi conferma se vuoi cambiare modello.

### Download dei modelli Hugging Face

Non inserire `HF_TOKEN` nella riga di comando. Leggilo da un file secret o dal secret manager.

```bash
python3 -m venv /opt/pianodivino-ai/.venv-hf
/opt/pianodivino-ai/.venv-hf/bin/pip install --upgrade pip "huggingface_hub[cli]"
export HF_HOME=/srv/ai/models/huggingface
```

Dopo che il proprietario ha accettato le licenze NVIDIA:

```bash
/opt/pianodivino-ai/.venv-hf/bin/hf download \
  nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 \
  --local-dir /srv/ai/models/nemotron-nano-nvfp4

/opt/pianodivino-ai/.venv-hf/bin/hf download \
  nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4 \
  --local-dir /srv/ai/models/nemotron-super-nvfp4

/opt/pianodivino-ai/.venv-hf/bin/hf download \
  nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4 \
  --local-dir /srv/ai/models/nemotron-omni-nvfp4

/opt/pianodivino-ai/.venv-hf/bin/hf download \
  nvidia/Nemotron-3-Embed-1B-BF16 \
  --local-dir /srv/ai/models/nemotron-embed-1b
```

Registra nel lockfile l'hash/revisione effettivamente scaricata. Non rieseguire download non bloccati durante l'avvio dei servizi.

### Serving dei modelli testuali

Installa vLLM/SGLang in immagini o ambienti separati e bloccati. Per ogni modello crea uno script in `scripts/models/` gestito dal GPU Model Manager. Base di partenza, da adeguare alla model card e alla versione verificata:

```bash
vllm serve /srv/ai/models/nemotron-nano-nvfp4 \
  --served-model-name nemotron-nano \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.90
```

```bash
vllm serve /srv/ai/models/nemotron-super-nvfp4 \
  --served-model-name nemotron-super \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.94
```

Se vLLM non supporta correttamente l'architettura o NVFP4 nella versione verificata, usa SGLang secondo la model card ufficiale:

```bash
python3 -m sglang.launch_server \
  --model-path /srv/ai/models/nemotron-nano-nvfp4 \
  --host 0.0.0.0 \
  --port 30000
```

Non lanciare mai questi comandi manualmente in produzione: il Model Manager deve avviarli in container isolati, effettuare health check e terminarli ordinatamente.

### Modello embedding

Test iniziale:

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    "/srv/ai/models/nemotron-embed-1b",
    device="cpu",
)
vectors = model.encode(
    ["query: quali decisioni abbiamo preso?", "passage: Il cliente ha scelto il tema notte e oro."],
    normalize_embeddings=True,
)
assert vectors.shape[0] == 2
```

Conferma sulla model card i prefissi query/documento corretti e la dimensione degli embedding prima di creare lo schema pgvector.

### Cosmos Predict2.5 video

Per Blackwell usa il repository mantenuto Predict2.5:

```bash
cd /opt/pianodivino-ai/vendor
git clone https://github.com/nvidia-cosmos/cosmos-predict2.5.git
cd cosmos-predict2.5
git lfs install
git lfs pull
sudo apt-get install -y curl ffmpeg libx11-dev tree wget
curl -LsSf https://astral.sh/uv/install.sh | sh
uv python install
uv sync --extra=cu128
```

La documentazione ufficiale richiede Linux x86-64, glibc almeno 2.35 e driver NVIDIA almeno compatibile con CUDA 12.8.1. Su Blackwell può essere usato anche il Dockerfile notturno previsto dal repository:

```bash
docker build -f docker/nightly.Dockerfile -t pdai/cosmos-predict2.5:<COMMIT> .
```

Imposta `HF_HOME=/srv/ai/models/huggingface`. I checkpoint vengono scaricati durante la prima inferenza; in produzione esegui preventivamente un warm-up controllato, blocca gli snapshot risultanti e vieta download durante le richieste cliente.

### Cosmos Predict2 Text2Image

Poiché il repository è archiviato:

```bash
cd /opt/pianodivino-ai/vendor
git clone https://github.com/nvidia-cosmos/cosmos-predict2.git
cd cosmos-predict2
git checkout <COMMIT_VERIFICATO>
git lfs install
git lfs pull
```

Segui il `documentations/setup.md` della revisione bloccata e installalo in un ambiente/container separato da Predict2.5. Prima di esporlo esegui test di generazione, VRAM, licenza e vulnerabilità delle dipendenze.

### Magpie TTS

La reference NVIDIA corrente usa NIM:

```yaml
services:
  magpie-tts:
    image: nvcr.io/nim/nvidia/magpie-tts-multilingual:1.8.0
    environment:
      NGC_API_KEY: ${NVIDIA_API_KEY}
      NIM_HTTP_API_PORT: "9000"
      NIM_GRPC_API_PORT: "50051"
      NIM_TAGS_SELECTOR: "name=magpie-tts-multilingual,batch_size=8"
    volumes:
      - /srv/ai/models/nim-cache:/opt/nim/.cache
    shm_size: 16gb
    networks: [pdai_internal]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["0"]
              capabilities: [gpu]
```

Non pubblicare le porte NIM sull'host. Magpie deve essere anch'esso attivato dal Model Manager perché usa la stessa GPU. Verifica la licenza NIM e l'accesso NGC prima di considerarlo installato.

## Vincolo fondamentale della GPU

La singola GPU da 96 GB non può mantenere contemporaneamente in VRAM tutti i modelli. Implementa un `GPU Model Manager`, non tentare il caricamento simultaneo.

Stati minimi:

- `IDLE`
- `DOWNLOADING`
- `UNLOADING`
- `LOADING`
- `READY`
- `RUNNING`
- `FAILED`

Funzionamento:

1. Nano è il modello predefinito.
2. OpenClaw classifica la richiesta.
3. Se serve un altro modello, crea un job in Redis.
4. Il manager termina in modo ordinato il worker GPU corrente.
5. Verifica che la VRAM sia stata liberata.
6. Avvia il worker richiesto.
7. Attende un health check reale.
8. Esegue il job.
9. Salva il risultato.
10. Dopo una finestra di inattività configurabile, torna al modello Nano.

Non eseguire due worker GPU pesanti contemporaneamente. Magpie TTS può restare su CPU o GPU solo se le misure dimostrano che non interferisce.

Implementa una API interna autenticata per:

- `GET /health`
- `GET /state`
- `GET /models`
- `POST /activate`
- `POST /jobs`
- `GET /jobs/{id}`
- `POST /jobs/{id}/cancel`

La API non deve essere pubblica.

## Runtime LLM

Usa vLLM o il runtime NVIDIA ufficialmente raccomandato dal model card corrente. Esponi un endpoint OpenAI-compatible solo sulla rete privata.

Registra in OpenClaw il provider locale usando il formato supportato dalla versione corrente. Non modificare il provider globale di eventuali altre installazioni.

Parametri iniziali prudenti:

- Nano: contesto massimo operativo 32k, con limite utente più basso finché non è misurato;
- Super: contesto iniziale 16k o 32k, batch ridotto;
- riserva VRAM per KV cache e overhead;
- concurrency LLM iniziale `1`, poi aumenta solo dopo benchmark;
- timeout lunghi per cold start;
- streaming abilitato;
- rate limit per utente.

Misura e registra:

- tempo di caricamento;
- token/secondo;
- time-to-first-token;
- VRAM di picco;
- RAM di picco;
- comportamento con contesto lungo.

# OPENCLAW INDIPENDENTE

Installa una versione stabile e aggiornata di OpenClaw, bloccata a una versione esatta. Usa il metodo ufficiale corrente e verifica le note di sicurezza.

Requisiti:

- istanza e workspace nuovi;
- gateway dedicato;
- identificatore del progetto `pianodivino-ai`;
- configurazione sotto `/etc/pianodivino-ai` e `/srv/ai/openclaw`;
- servizio systemd o container con restart automatico;
- health check;
- token del gateway generato casualmente, custodito server-side;
- nessun pairing o pannello amministrativo disponibile al cliente;
- Control UI amministrativa raggiungibile esclusivamente da VPN/Tailscale o tunnel SSH;
- interfaccia cliente separata e chat-only.

Il frontend cliente deve usare OpenClaw come orchestratore. Non bypassare OpenClaw collegando la chat direttamente a vLLM.

## Strumenti OpenClaw da creare

Crea un plugin/skill locale dedicato, versionato nel progetto, con strumenti almeno per:

- `web_search`
- `browser_open`
- `browser_extract`
- `analyze_media`
- `generate_image`
- `generate_video`
- `generate_speech`
- `job_status`
- `job_cancel`
- `list_outputs`
- `github_repo_get`
- `github_pr_get`
- `github_actions_get`
- `github_actions_logs`
- `github_api_rest`
- `github_api_graphql`

Ogni strumento deve:

- validare input e dimensione file;
- imporre timeout;
- applicare autorizzazione per utente;
- produrre log di audit senza contenuti sensibili;
- restituire risultati strutturati;
- non consentire path traversal o comandi arbitrari.

# BROWSING WEB SICURO

Installa:

- SearXNG self-hosted per ricerca;
- Chromium/Playwright in container isolato per pagine JavaScript e interazioni;
- fetch statico di OpenClaw quando sufficiente.

Misure obbligatorie:

- container browser senza privilegi;
- profilo effimero per sessione;
- download in directory in quarantena;
- blocco dell'accesso a metadata endpoint, rete interna, loopback e RFC1918;
- limiti CPU/RAM/tempo;
- blocco di `file://`;
- protezione SSRF;
- egress policy;
- scansione e validazione degli allegati;
- marcatura del contenuto web come non affidabile;
- protezione da prompt injection.

Richiedi sempre conferma umana prima di inviare messaggi, pubblicare, acquistare, cancellare dati, accettare termini o eseguire azioni irreversibili.

# AUTENTICAZIONE E SICUREZZA

Il cliente deve fare un solo login con username e password.

Implementa:

- database utenti separato;
- password hash Argon2id;
- session cookie `HttpOnly`, `Secure`, `SameSite=Lax` o più restrittivo;
- rotazione della sessione al login;
- CSRF protection;
- rate limit e lockout progressivo;
- logout;
- audit degli accessi;
- nessun token OpenClaw nel browser, URL o localStorage;
- header HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`;
- upload con allowlist MIME, limite dimensione e nomi casuali;
- separazione dei file per utente;
- secret in file root-only o secret manager, mai in Git.

Crea l'utente cliente solo alla fine. Genera una password casuale lunga almeno 20 caratteri e consegnala una sola volta al proprietario attraverso il canale sicuro disponibile. Non riportarla nella documentazione o nei commit.

Prevedi un comando amministrativo locale:

```bash
pdai-user create <username>
pdai-user reset-password <username>
pdai-user disable <username>
pdai-user list
```

I comandi devono evitare che la password finisca nella shell history: devono leggerla in modo interattivo oppure generarla.

# INTERFACCIA CLIENTE

Nome provvisorio: **PianoDivino AI Studio**.

Non usare l'interfaccia amministrativa standard come pagina cliente. Crea una web app responsive, accessibile e installabile come PWA.

Puoi partire dal frontend ufficiale di OpenClaw per mantenere il protocollo corretto, ma devi creare un fork/build dedicato e rimuovere tutte le funzioni amministrative dal bundle cliente. Se usi GitHub, crea un repository privato dedicato e non inserire segreti.

## Design

Stile:

- elegante, contemporaneo e sobrio;
- fondo blu-notte quasi nero;
- superfici leggermente traslucide;
- accento oro caldo;
- testo avorio;
- bordi sottili;
- animazioni brevi e non invadenti;
- ottimo contrasto;
- niente effetto “dashboard tecnica”.

Token iniziali:

```css
:root {
  --pd-bg: #080b12;
  --pd-bg-soft: #0d1220;
  --pd-surface: rgba(20, 27, 43, 0.82);
  --pd-surface-strong: #151d2d;
  --pd-border: rgba(255, 255, 255, 0.09);
  --pd-text: #f5f0e6;
  --pd-muted: #9aa4b5;
  --pd-gold: #d6aa5c;
  --pd-gold-soft: #f0cf8c;
  --pd-success: #5dc89f;
  --pd-danger: #f07878;
  --pd-radius: 18px;
  --pd-shadow: 0 22px 70px rgba(0, 0, 0, 0.34);
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--pd-text);
  background:
    radial-gradient(circle at 15% 10%, rgba(84, 104, 170, 0.18), transparent 34rem),
    radial-gradient(circle at 90% 15%, rgba(214, 170, 92, 0.10), transparent 28rem),
    var(--pd-bg);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

## Layout desktop

- barra laterale sinistra comprimibile;
- logo e nome in alto;
- pulsante “Nuova conversazione”;
- cronologia chat;
- scorciatoie “Crea immagine”, “Crea video”, “Genera voce”, “Analizza file”;
- area centrale di conversazione;
- header minimale con nome agente e stato;
- composer ampio in basso;
- pannello lavori apribile a destra;
- avatar utente e logout in fondo.

## Layout mobile

- sidebar in drawer;
- composer sempre raggiungibile;
- lavori in bottom sheet;
- anteprime media a tutta larghezza;
- nessuna tabella tecnica.

## Composer

Deve includere:

- testo multilinea;
- drag-and-drop;
- allegati;
- selezione rapida modalità `Auto`, `Veloce`, `Profondo`;
- pulsante invio/stop;
- stato del modello espresso in linguaggio umano.

Non mostrare nomi tecnici dei modelli al cliente. Usa:

- `Veloce` → Nemotron Nano;
- `Profondo` → Nemotron Super;
- `Visione` → Nemotron Omni;
- `Immagine`, `Video`, `Voce` per i generatori.

## Stati della GPU in linguaggio cliente

Traduci gli stati tecnici:

- `DOWNLOADING` → “Preparazione iniziale”
- `UNLOADING` → “Cambio strumento”
- `LOADING` → “Preparazione del modello”
- `RUNNING` → “Elaborazione”
- `FAILED` → “Elaborazione non riuscita”

Mostra una stima realistica, non una percentuale inventata. Se non esiste una misura reale, usa uno spinner e la fase corrente.

## Schede risultato

Immagine:

- anteprima;
- prompt;
- dimensioni;
- scarica;
- rigenera;
- crea variante.

Video:

- player;
- durata;
- stato coda;
- scarica;
- rigenera.

Audio:

- player waveform;
- testo;
- voce;
- scarica.

## Pagina login

Una singola card centrata, logo, username, password, mostra/nascondi password, messaggi di errore neutri. Non rivelare se lo username esiste. Dopo il login torna alla pagina richiesta.

## Accessibilità

- WCAG AA;
- navigazione tastiera;
- focus visibile;
- `aria-label`;
- supporto `prefers-reduced-motion`;
- errori associati ai campi;
- contrasto verificato automaticamente.

# API DEL BACKEND/BFF

Adatta nomi e payload alla tecnologia scelta, ma mantieni il confine:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/{id}/messages`
- `POST /api/conversations/{id}/messages`
- `POST /api/uploads`
- `GET /api/jobs`
- `GET /api/jobs/{id}`
- `POST /api/jobs/{id}/cancel`
- `GET /api/outputs`
- `GET /api/outputs/{id}/download`

Usa SSE o WebSocket per token e stato lavori. Il BFF deve verificare la sessione su ogni chiamata.

# DOMINIO E HTTPS

Usa `ai.pianodivino.com`.

Prima verifica:

1. IP pubblico statico riservato alla VM;
2. record DNS `A` del sottodominio;
3. raggiungibilità di porta 80 e 443;
4. assenza di proxy o record incompatibili.

Se il DNS non punta ancora alla VM, termina l'installazione locale, mostra l'IP esatto e chiedi al proprietario di creare:

```text
Tipo: A
Nome: ai
Valore: <IP_STATICO_DELLA_VM>
TTL: 300
```

Non fingere che HTTPS sia operativo prima della propagazione DNS. Dopo la propagazione, lascia che Caddy ottenga e rinnovi automaticamente il certificato.

# STORAGE E BACKUP

Persisti:

- configurazione;
- database utenti;
- conversazioni;
- output;
- audit;
- manifest e revisioni modelli.

Usa Google Cloud Storage per una seconda copia degli output e dei backup se service account e bucket sono disponibili. Applica privilegi minimi.

Backup:

- database giornaliero;
- configurazione giornaliera;
- conservazione 7 giornalieri + 4 settimanali;
- cifratura;
- verifica periodica del ripristino;
- nessun segreto nei log.

# OSSERVABILITÀ

Implementa:

- health check per ogni servizio;
- metriche GPU con NVIDIA DCGM Exporter;
- metriche host;
- metriche code;
- log strutturati con rotazione;
- allarme per GPU bloccata, disco oltre 80%, servizio non raggiungibile, certificato in scadenza e backup fallito;
- pagina amministrativa non pubblica o dashboard accessibile solo via tunnel/VPN.

Non mostrare stack trace al cliente.

# ORDINE DI IMPLEMENTAZIONE

## Fase 0 — Preflight

Raccogli e registra:

```bash
uname -a
cat /etc/os-release
lscpu
free -h
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS
nvidia-smi
df -h
ip -brief address
ss -lntup
```

Verifica quota GPU, driver, Secure Boot, dischi, IP statico, DNS e firewall.

Se la GPU non appare o l'hardware non corrisponde a `g4-standard-48`, fermati e segnala il problema.

## Fase 1 — Base sicura

- aggiorna il sistema;
- installa driver NVIDIA e container toolkit compatibili con Blackwell;
- installa Docker Engine/Compose dal repository ufficiale;
- crea utente, directory, mount persistenti e permessi;
- configura firewall, fail2ban o equivalente, NTP e log rotation;
- esegui un test CUDA in container.

## Fase 2 — Repository e infrastruttura

Crea sotto `/opt/pianodivino-ai`:

```text
pianodivino-ai/
├── apps/
│   ├── web/
│   └── bff/
├── services/
│   ├── model-manager/
│   ├── memory-steward/
│   ├── credential-broker/
│   ├── github-manager/
│   └── openclaw-tools/
├── infra/
│   ├── compose/
│   ├── caddy/
│   └── systemd/
├── config/
├── scripts/
├── tests/
├── docs/
├── .env.example
├── compose.yaml
├── Makefile
└── README.md
```

Se hai accesso GitHub autorizzato, crea o usa un repository privato dedicato. Esegui commit piccoli e leggibili. Non committare `.env`, password, token, modelli, output o database.

## Fase 3 — OpenClaw

- installazione pulita;
- configurazione home/workspace dedicati;
- gateway su rete privata;
- provider locale;
- plugin strumenti;
- policy e conferme;
- test chat semplice;
- test chiamata tool.

## Fase 4 — Model manager

- coda Redis;
- lock GPU globale;
- lifecycle dei worker;
- health check;
- timeout e cancellazione;
- persistenza stato job;
- ripresa dopo restart;
- test di cambio Nano → media → Nano.

## Fase 5 — Modelli

Scarica un modello alla volta dopo verifica licenza.

Ordine:

1. Nano;
2. Magpie;
3. Omni;
4. modello immagine;
5. modello video;
6. Super.

Dopo ogni modello esegui un test funzionale e registra memoria, tempo e revisione.

## Fase 6 — Browsing

- SearXNG;
- fetch;
- browser isolato;
- protezione SSRF e rete interna;
- test ricerca con fonti;
- test pagina JavaScript;
- test che metadata endpoint e rete privata siano bloccati.

## Fase 6B — GitHub Manager e ByteRover

- installa e blocca GitHub CLI;
- collega l'identità GitHub tramite Portachiavi;
- implementa wrapper JSON e policy di conferma;
- crea workspace/worktree isolati;
- testa repository, PR, issue, Actions e log;
- installa ByteRover in modalità local-first;
- collegalo soltanto agli agenti coding;
- verifica curation, review e richiamo della memoria tecnica;
- verifica che Mem0 resti l'unico context engine generale.

## Fase 7 — UI e autenticazione

- login;
- sessioni;
- chat streaming;
- allegati;
- coda lavori;
- galleria risultati;
- responsive;
- accessibilità;
- nessun elemento amministrativo;
- nessun segreto client-side.

## Fase 8 — Dominio

- Caddy;
- DNS;
- certificato;
- redirect HTTP → HTTPS;
- header di sicurezza;
- test pubblico.

## Fase 9 — Collaudo

Esegui tutti i test di accettazione elencati sotto.

# TEST DI ACCETTAZIONE

Il progetto è completo soltanto se:

- [ ] `https://ai.pianodivino.com` presenta certificato valido.
- [ ] Un utente anonimo non può raggiungere UI, API, file o WebSocket.
- [ ] Il cliente effettua un solo login con username e password.
- [ ] Il browser non riceve token OpenClaw o segreti infrastrutturali.
- [ ] La chat risponde in streaming con Nano.
- [ ] La modalità Profondo attiva Super e risponde.
- [ ] Un'immagine caricata viene analizzata con Omni.
- [ ] La ricerca web restituisce fonti cliccabili.
- [ ] Il browser apre una pagina JavaScript senza poter raggiungere reti private.
- [ ] La generazione immagine produce un file visualizzabile e scaricabile.
- [ ] La generazione video entra in coda, mostra lo stato e produce un file riproducibile.
- [ ] La TTS italiana produce audio riproducibile.
- [ ] Due richieste GPU concorrenti non caricano due modelli pesanti insieme.
- [ ] Dopo un errore il lock GPU viene rilasciato.
- [ ] Un reboot della VM ripristina automaticamente tutti i servizi.
- [ ] Output e conversazioni persistono dopo reboot.
- [ ] Le porte interne non sono raggiungibili dall'esterno.
- [ ] Il cliente non vede pagine amministrative.
- [ ] Una nuova conversazione richiama correttamente una scelta presa in una conversazione precedente.
- [ ] Una correzione invalida la memoria vecchia senza perdere origine e cronologia.
- [ ] Ricordi appartenenti a utenti differenti non vengono mai mescolati.
- [ ] Il cliente può consultare, correggere, esportare e cancellare i propri ricordi.
- [ ] Password, token e contenuti web malevoli non vengono acquisiti come memoria.
- [ ] Se Mem0/Graphiti è offline la chat continua senza inventare ricordi.
- [ ] Backup e ripristino ricostruiscono archivio, vector store e grafo temporale.
- [ ] Il Portachiavi salva, ruota, revoca e usa una credenziale senza inserirla nel prompt.
- [ ] Il modello, la memoria, i log e il browser non ricevono il valore della credenziale.
- [ ] Un cliente o agente non autorizzato non può elencare né usare credenziali altrui.
- [ ] Il form Portachiavi impedisce cache, autocomplete e persistenza client-side dei segreti.
- [ ] Il Credential Broker distrugge i file temporanei anche dopo timeout o errore.
- [ ] Il reboot riporta OpenBao e il broker in stato operativo senza lasciare chiavi di recovery in chiaro sulla VPS.
- [ ] Snapshot cifrato e ripristino del Portachiavi sono stati provati.
- [ ] GitHub Manager legge repository, PR, issue e Actions restituendo JSON valido.
- [ ] Il token GitHub viene iniettato dal Portachiavi e non persiste nella configurazione `gh`.
- [ ] I log Actions vengono ripuliti da token, segreti ed email prima di raggiungere il modello.
- [ ] Push, PR, workflow, merge e operazioni distruttive rispettano i livelli di conferma.
- [ ] Codice proveniente da PR non attendibili viene testato soltanto in container isolato.
- [ ] ByteRover richiama una decisione tecnica precedente con riferimento a commit o PR.
- [ ] ByteRover non duplica memoria generale, conversazioni cliente o segreti.
- [ ] Disabilitando ByteRover, GitHub Manager continua a funzionare usando Git e GitHub.
- [ ] La password non compare in log, process list, shell history o repository.
- [ ] Il backup viene creato e un ripristino di prova riesce.
- [ ] Il repository non contiene segreti, file cliente o pesi dei modelli.

Esegui anche:

- test mobile;
- test Chrome e Firefox;
- test tastiera;
- test upload non valido;
- test file troppo grande;
- test rate limit;
- test sessione scaduta;
- test cancellazione job;
- test disco quasi pieno simulato in ambiente controllato.

# CONSEGNA FINALE

Produci `/opt/pianodivino-ai/docs/HANDOVER.md` con:

1. URL cliente;
2. username consegnato, ma non la password;
3. stato DNS e HTTPS;
4. servizi installati e versioni;
5. modelli, revisioni e licenze;
6. tempi misurati, non stimati;
7. comandi start/stop/status;
8. procedura creazione/reset/disabilitazione utenti;
9. procedura backup e restore;
10. procedura aggiornamento con rollback;
11. directory persistenti;
12. costi cloud che richiedono controllo;
13. problemi noti;
14. test superati e test non superati;
15. eventuali passaggi manuali ancora necessari.

Consegna inoltre:

- `README.md`;
- `.env.example` privo di segreti;
- `ARCHITECTURE.md`;
- `SECURITY.md`;
- `RUNBOOK.md`;
- `MODEL_LICENSES.md`;
- un diagramma dell'architettura;
- una distinta dei componenti;
- screenshot desktop e mobile;
- report dei test;
- hash del commit Git installato;
- comando per rollback alla release precedente.

Nel messaggio finale sii preciso:

- dichiara “PRONTO” solo se tutti i test essenziali sono superati;
- altrimenti dichiara “BLOCCATO” e indica esattamente cosa manca;
- non nascondere errori o componenti simulati;
- non consegnare credenziali in chat se il canale non è sicuro.

# PARAMETRI DA CONFERMARE SOLO SE MANCANTI

Usa questi default senza interrompere inutilmente il lavoro:

- dominio: `ai.pianodivino.com`
- lingua UI: italiano
- nome UI: `PianoDivino AI Studio`
- username iniziale: `cliente`
- tema: notte e oro
- timezone: `Europe/Rome`

Chiedi al proprietario esclusivamente quando necessario:

- accesso DNS o conferma del record A;
- token Hugging Face/NVIDIA e accettazione licenze;
- service account/bucket GCS;
- IP autorizzati per SSH/VPN;
- conferma di eventuali costi cloud aggiuntivi;
- nome definitivo e logo, se devono sostituire il branding provvisorio.

Inizia ora dal preflight. Prima mostra un piano breve, poi procedi autonomamente per fasi. Fermati soltanto per un vero blocco di credenziali, licenza, DNS, permessi o costo non autorizzato.
