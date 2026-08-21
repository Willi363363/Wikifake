/**
 * Protocole WebSocket — miroir de `backend/app/ws/protocol.py`.
 *
 * Toute evolution se fait dans ces DEUX fichiers, nulle part ailleurs.
 * `GET /api/config` expose `wsCommands` : la liste reelle acceptee par le
 * serveur, utile pour verifier qu'on est bien synchronise.
 */

export const CLIENT = {
  GET_LOBBY: 'get_lobby',
  SET_READY: 'set_ready',
  SET_OPTIONS: 'set_options',
  START_VOTE: 'start_vote',
  SUBMIT_THEME: 'submit_theme',
  FORCE_PICK: 'force_pick',
  SELECTION_UPDATE: 'selection_update',
  SUBMIT_ANSWER: 'submit_answer',
  UNSUBMIT_ANSWER: 'unsubmit_answer',
  UNLOCK_HINT: 'unlock_hint',
  USE_ITEM: 'use_item',
  CURSOR: 'cursor',
  CHAT_MESSAGE: 'chat_message',
};

export const SERVER = {
  LOBBY_UPDATE: 'lobby_update',
  ERROR: 'error',
  THEME_VOTE_START: 'theme_vote_start',
  THEME_VOTE_UPDATE: 'theme_vote_update',
  THEME_SELECTED: 'theme_selected',
  GAME_START: 'game_start',
  GAME_END: 'game_end',
  LIVE_SCORE: 'live_score_update',
  CURSOR_UPDATE: 'cursor_update',
  ITEMS_GRANTED: 'items_granted',
  ITEM_EFFECT: 'item_effect',
  ITEM_USED: 'item_used',
  SCANNER_RESULT: 'scanner_result',
  HINT_UNLOCKED: 'hint_unlocked',
  ANSWER_ACK: 'answer_ack',
  CHAT_MESSAGE: 'chat_message',
};
