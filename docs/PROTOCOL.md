# Protocole réseau

Deux fichiers font foi et doivent rester synchronisés :

- `backend/app/ws/protocol.py`
- `frontend/src/net/protocol.js`

`GET /api/config` renvoie `wsCommands` : la liste réelle des commandes que le
serveur accepte. C'est le moyen de vérifier qu'on est synchronisé.

## Enveloppe

Client → serveur :

```json
{ "type": "submit_answer", "payload": { "selection": [2, 4] } }
```

Les champs à plat sont tolérés (`{"type": "...", "selection": [...]}`) mais
`payload` est la forme canonique.

Serveur → client :

```json
{ "type": "game_start", "theme": "Paris", "game": { … } }
```

## HTTP

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/ping` | Sonde de vie |
| `GET` | `/api/health` | Version, LLM configuré, salles actives |
| `GET` | `/api/config` | Configuration publique (durées, items, commandes) |
| `POST` | `/api/multiplayer/create` | Crée une salle → `{room_code}` |
| `GET` | `/api/multiplayer/{code}` | État d'une salle (404 si inconnue) |
| `POST` | `/api/game/start` | Partie solo → `{session_id, durationS, game}` |
| `POST` | `/api/game/{sid}/hint` | Indice (`level` 1 ou 2), facturé côté serveur |
| `POST` | `/api/game/{sid}/submit` | Correction → score, détail, solution |
| `POST` | `/api/flag-report` | Signale une erreur factuelle réelle |

`/api/game/start` et `/api/flag-report` sont limités en débit
(`app/api/rate_limit.py`) : ils déclenchent des appels LLM payants.

## WebSocket

`ws://<hôte>/ws/{ROOM_CODE}/{pseudo}`

Le pseudo est validé côté serveur (longueur, caractères). Un pseudo déjà
utilisé par un joueur **connecté** est refusé ; un joueur déconnecté qui
revient récupère son score et ses items.

### Client → serveur

| Type | Payload | Hôte seul | États autorisés |
|---|---|:---:|---|
| `get_lobby` | — | | tous |
| `set_ready` | `{ready}` | | `waiting` |
| `set_options` | `{durationS, withItems}` | ✔ | `waiting` |
| `start_vote` | `{durationS, withItems}` | ✔ | `waiting` |
| `submit_theme` | `{theme}` | | `theme_voting` |
| `force_pick` | — | ✔ | `theme_voting` |
| `selection_update` | `{selection: int[]}` | | `playing` |
| `submit_answer` | `{selection: int[]}` | | `playing` |
| `unsubmit_answer` | — | | `playing` |
| `unlock_hint` | `{targetIndex, level}` | | `playing` |
| `use_item` | `{instanceId, targets: string[]}` | | `playing` |
| `cursor` | `{x, y}` (0–1) | | `playing` |
| `chat_message` | `{content}` | | tous |

Les commandes marquées « hôte seul » sont refusées avec
`{"type":"error","code":"not_host"}` — le rôle est vérifié **côté serveur**.
Une commande envoyée dans un mauvais état est ignorée silencieusement.

### Serveur → client

| Type | Contenu |
|---|---|
| `lobby_update` | `{room: {code, state, players[], withItems, durationS}}` |
| `error` | `{message, code}` |
| `theme_vote_start` | — |
| `theme_vote_update` | `{submitted: string[], total}` |
| `theme_selected` | `{theme, proposer}` |
| `game_start` | `{theme, game, players[], durationS, withItems}` |
| `live_score_update` | `{player, score}` (provisoire, calculé par le serveur) |
| `cursor_update` | `{player, x, y}` |
| `items_granted` | `{wave, items: {pseudo: {instance_id, item_id}}}` |
| `item_effect` | `{item_id, from}` — envoyé à la **cible** seulement |
| `item_used` | `{player, item_id, targets[]}` — diffusé (fil d'événements) |
| `scanner_result` | `{paragraph_index}` — cible seulement |
| `hint_unlocked` | `{target_index, level, hint, paragraph_index?}` |
| `answer_ack` | `{answered}` |
| `game_end` | `{leaderboard[], solution[]}` |
| `chat_message` | `{sender, content, at}` |

### Ce que le client ne reçoit jamais avant la fin

`game.paragraphs[]` ne contient que `{index, text}`. Les indices des
paragraphes falsifiés, les explications et les indices textuels n'arrivent
que via :

- `hint_unlocked` — sur demande explicite, avec un coût en points ;
- `scanner_result` — via l'item Détecteur ;
- `game_end.solution` / la réponse de `/submit` — à la fin.

## Machine à états d'une salle

```
waiting ──start_vote──▶ theme_voting ──(tous ont voté | force_pick)──▶ generating
   ▲                                                                       │
   └──────────────── game_end ◀──── playing ◀──── génération terminée ──────┘
```

`generating` exécute la génération dans un thread (`asyncio.to_thread`) :
la boucle d'événements reste libre, les WebSockets des autres salles ne
gèlent pas.

Une partie se termine quand tous les joueurs connectés ont répondu **ou**
quand le serveur atteint la limite de temps (`durationS + 5 s`), ce qui
couvre les onglets fermés ou endormis.

## Cycle de vie

- Une salle vide est supprimée par une tâche de nettoyage après
  `WIKIFAKE_ROOM_TTL` secondes (900 par défaut).
- Les codes de salle sont garantis uniques et le nombre de salles est borné
  (`WIKIFAKE_MAX_ROOMS`).
- Les sessions solo expirent au bout d'une heure.
