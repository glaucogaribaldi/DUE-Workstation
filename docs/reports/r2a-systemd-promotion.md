# FASE R2A.1 — Promozione Systemd del DUE Action Broker

Data: 27 luglio 2026
Target: VPS orchestratore `34.9.150.177`
Commit R2A verificato: `2fece0f45150c1ab1bd582e5dc28a932f0e52f60`

## Decisione architetturale

Il canary manuale R2A ha verificato il Broker via Unix socket senza modificare PM2, senza listener TCP e senza esposizione Nginx.

Il passo successivo è rendere il Broker un servizio locale persistente con systemd. L'integrazione Web App verrà sviluppata dopo questa promozione, in una PR separata, tramite un endpoint dedicato. Il vecchio `app/api/terminal/route.ts` non deve essere usato come adapter del Broker.

## Vincoli invarianti

- solo `/run/due-action-broker/broker.sock`;
- nessun listener TCP;
- nessuna regola Nginx o firewall;
- unica azione `service.inspect`;
- unico target `pianodivino-ui`;
- processo eseguito come utente e gruppo `zava`;
- `HOME=/home/zava` e `PM2_HOME=/home/zava/.pm2`;
- audit JSON su journald;
- nessun segreto nel file environment;
- rollback immediato senza downtime del frontend.

## 1. Preflight

Eseguire come `zava` nella copia locale del repository sulla VPS:

```bash
git fetch origin
git checkout master
git reset --hard origin/master
test "$(git rev-parse HEAD)" = "2fece0f45150c1ab1bd582e5dc28a932f0e52f60"
REPO_ROOT="$(git rev-parse --show-toplevel)"
pm2 describe pianodivino-ui
pgrep -af 'due-action-broker|dist/index.js' || true
sudo systemctl is-active due-action-broker.service || true
sudo ss -lxnp | grep '/run/due-action-broker/broker.sock' || true
```

Non procedere se esiste ancora un processo canary attivo. Un socket residuo può essere rimosso solo dopo aver verificato che non sia in ascolto e che appartenga a `zava`.

## 2. Build verificata

```bash
cd "$REPO_ROOT/services/due-action-broker"
npm ci
npm run typecheck
npm run build
npm test
node -e "require('./dist/index.js')"
```

Tutti i comandi devono terminare con exit code `0`.

## 3. Release immutabile

```bash
COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
RELEASE="/opt/due/action-broker/releases/$COMMIT"

sudo install -d -o root -g root -m 0755 /opt/due/action-broker/releases
sudo install -d -o root -g root -m 0755 "$RELEASE"
sudo cp -a dist package.json package-lock.json "$RELEASE"/
cd "$RELEASE"
sudo npm ci --omit=dev --ignore-scripts
sudo chown -R root:root "$RELEASE"
sudo chmod 0755 "$RELEASE" "$RELEASE/dist"
sudo chmod 0644 "$RELEASE/package.json" "$RELEASE/package-lock.json" "$RELEASE/dist/index.js"
sudo ln -sfn "$RELEASE" /opt/due/action-broker/current
```

Il processo systemd legge il codice da `/opt/due/action-broker/current`, non dalla working copy Git. Non modificare ricorsivamente i permessi interni di `node_modules` dopo `npm ci`.

## 4. Environment e unit

```bash
sudo install -d -o root -g root -m 0755 /etc/due
printf 'BUILD_VERSION=%s\nNODE_ENV=production\nHOME=/home/zava\nPM2_HOME=/home/zava/.pm2\n' "$COMMIT" \
  | sudo tee /etc/due/action-broker.env >/dev/null
sudo chown root:root /etc/due/action-broker.env
sudo chmod 0644 /etc/due/action-broker.env

sudo install -o root -g root -m 0644 \
  "$REPO_ROOT/deploy/systemd/due-action-broker.service" \
  /etc/systemd/system/due-action-broker.service

sudo systemd-analyze verify /etc/systemd/system/due-action-broker.service
sudo systemctl daemon-reload
sudo systemctl enable --now due-action-broker.service
```

## 5. Verifiche obbligatorie

### Stato e socket

```bash
sudo systemctl is-enabled due-action-broker.service
sudo systemctl is-active due-action-broker.service
sudo systemctl status due-action-broker.service --no-pager
stat -c '%F %a %U %G %n' /run/due-action-broker/broker.sock
```

Risultato atteso del socket:

```text
socket 660 zava zava /run/due-action-broker/broker.sock
```

### Chiamata read-only

```bash
REQUEST_ID="$(cat /proc/sys/kernel/random/uuid)"
curl --fail-with-body --silent --show-error \
  --unix-socket /run/due-action-broker/broker.sock \
  -H 'content-type: application/json' \
  -d "{\"schemaVersion\":\"1.0\",\"requestId\":\"$REQUEST_ID\",\"actor\":{\"id\":\"zava\",\"role\":\"zava\"},\"action\":\"service.inspect\",\"target\":\"pianodivino-ui\",\"parameters\":{}}" \
  http://localhost/v1/actions
```

La risposta deve essere JSON tipizzato, privo di environment, command line, token e payload PM2 integrale.

### Assenza di TCP e integrità PM2

```bash
BROKER_PID="$(sudo systemctl show due-action-broker.service -p MainPID --value)"
sudo ss -ltnp | grep "pid=$BROKER_PID," && exit 1 || true
pm2 describe pianodivino-ui
sudo journalctl -u due-action-broker.service -n 30 --no-pager
```

Il frontend deve restare online con PID e restart count coerenti con il preflight.

## 6. Osservazione iniziale

Durante la prima finestra operativa controllare:

```bash
sudo systemctl show due-action-broker.service \
  -p ActiveState -p SubState -p NRestarts -p MainPID
sudo journalctl -u due-action-broker.service --since '-15 minutes' --no-pager
```

Non aggiungere Nginx, TCP, autenticazione alternativa o nuove azioni durante questa fase.

## 7. Rollback immediato

```bash
sudo systemctl disable --now due-action-broker.service
sudo rm -f /etc/systemd/system/due-action-broker.service
sudo systemctl daemon-reload
sudo systemctl reset-failed due-action-broker.service || true
sudo rm -f /run/due-action-broker/broker.sock
```

Il rollback non deve fermare o riavviare `pianodivino-ui`, OpenClaw o il daemon PM2.

## 8. Evidenze da versionare

UNO deve creare un report successivo in `docs/reports/` contenente:

- commit installato;
- path release;
- output redatto di `systemctl`;
- proprietà e permessi socket;
- risposta JSON redatta;
- verifica assenza TCP;
- stato PM2 prima e dopo;
- estratto journald privo di dati sensibili;
- eventuali deviazioni;
- prova del rollback o comandi verificati.

## Passo successivo

Dopo il GO della promozione systemd, aprire `feat/r3-ui-action-broker-adapter`.

La Web App userà un endpoint dedicato, per esempio:

```text
POST /api/actions/service-inspect
```

Non verrà riutilizzato `/api/terminal/route.ts`, perché il terminale legacy ha semantica e superficie di rischio diverse dal Broker tipizzato.
