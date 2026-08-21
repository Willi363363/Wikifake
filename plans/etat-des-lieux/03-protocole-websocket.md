# État des lieux — le protocole WebSocket

`/ws/{room_code}/{player_name}`. Le pseudo est validé (longueur, caractères) et
un pseudo déjà utilisé par un joueur connecté est refusé.

## Messages entrants

Entrants, gérés dans `realtime/handlers.py` :

`set_ready`, `get_lobby`, `force_start`, `submit_theme`, `force_pick`,
`start_game`, `live_score`, `cursor`, `chat_message`, `use_item`,
`unlock_hint`, `submit_answer`, `unsubmit_answer`.

## Autorisations d'hôte

`force_start`, `force_pick` et `start_game` sont **réservés à l'hôte**, vérifié
côté serveur (`Player.is_host`) ; les autres joueurs reçoivent
`{"type": "error", "code": "not_host"}`. Les options de manche (durée, items)
ne sont appliquées que si l'émetteur est l'hôte.

## Messages sortants

Sortants :

`lobby_update`, `theme_vote_start`, `theme_vote_update`, `theme_selected`,
`game_start`, `live_score_update`, `cursor_update`, `chat_message`,
`items_distributed`, `item_effect`, `item_used`, `hint_unlocked`,
`scanner_result`, `game_end`, `error`.

### Le barème

`src/scoring.py` fait foi, pour le solo comme pour le multijoueur.

Côté front, `features/game/useScore.js` **ne calcule plus les détections** — il
n'en a pas les moyens, puisqu'il ignore la solution. `finalStats` recompose
l'affichage du débriefing à partir du barème renvoyé par le serveur.
`useLiveScore` reste un affichage optimiste pendant la manche : il compte
délibérément chaque marque comme correcte, pour qu'on ne puisse pas lire la
solution dans le score d'un adversaire.
