# État des lieux — déploiement

## L'image Docker

Image Docker multi-étages (`Dockerfile`) : le front est buildé dans un étage
Node, puis copié dans l'image Python à `frontend/dist`, que `static_files.py`
sert. Render injecte `$PORT`.

```bash
docker build -t wikifake .
docker run -p 8000:8000 -e GEMINI_API_KEY=... wikifake
```

## Savoir si la production est à jour

`GET /api/health` répond **quelle version tourne** :

```json
{"status":"ok","version":"1.1.0","commit":"5d9d884…","model":"gemini-3.1-flash-lite","llm_configured":true}
```

`commit` vient de `RENDER_GIT_COMMIT`, injecté par la plateforme ; il est vide
en local, c'est normal.

## La sonde `deploy-check`

Le workflow `deploy-check.yml` interroge cette route après chaque push sur
`main` et attend que le commit servi soit celui qui vient d'être poussé. C'est
ce qui remplace l'aller-retour manuel vers le tableau de bord Render — le
dépôt ne publiait auparavant ni statut de commit, ni déploiement, ni
environnement.

Il faut lui donner l'URL, une seule fois :

> **Settings → Secrets and variables → Actions → Variables → New**
> `DEPLOY_URL` = `https://<service>.onrender.com`

Sans cette variable, le job s'ignore proprement et explique comment le
configurer : un fork ne verra jamais échouer sa CI à cause de ça.

## `render.yaml`

`render.yaml` versionne la configuration du service (Dockerfile, branche,
déploiement automatique, `healthCheckPath`). **Il n'a d'effet que si le service
est rattaché à un Blueprint** — tant qu'il est configuré à la main dans le
tableau de bord, ce fichier documente la configuration attendue sans
l'appliquer. Les clés d'API y sont marquées `sync: false` : elles restent dans
le tableau de bord.
