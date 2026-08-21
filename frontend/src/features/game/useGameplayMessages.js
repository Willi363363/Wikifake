/**
 * Traduction des messages de gameplay en mises a jour d'etat.
 *
 * Toute la reception WebSocket du jeu est ici, sous forme de TABLE. Ajouter
 * un message = ajouter une entree. L'ancien code avait un `if/else if` de
 * 13 branches dans un `useEffect` de 90 lignes.
 */

import { useEffect } from 'react';

import { EFFECT_TOAST_MS } from '@/config/constants';
import { getItemDef } from '@/config/items';
import { playSound } from '@/lib/sound';
import { SERVER } from '@/net/protocol';

export function useGameplayMessages({
  engine,
  onGrantItem,
  onEffect,
  onScannerResult,
  onLiveScore,
  onCursor,
  onAnswerAck,
}) {
  useEffect(() => {
    if (!engine?.subscribe) return undefined;

    const handlers = {
      [SERVER.ITEMS_GRANTED]: (message) => {
        const mine = message.items?.[engine.playerName];
        if (!mine) return;
        playSound('item_receive');
        onGrantItem(mine);
      },
      [SERVER.ITEM_EFFECT]: (message) => {
        const def = getItemDef(message.item_id);
        playSound(message.item_id === 'SCANNER' ? 'scanner' : 'malus');
        onEffect({
          id: `${message.item_id}-${Date.now()}`,
          itemId: message.item_id,
          icon: def.icon,
          name: def.name,
          from: message.from,
          expiresIn: EFFECT_TOAST_MS,
        });
      },
      [SERVER.SCANNER_RESULT]: (message) => {
        playSound('scanner');
        onScannerResult(message.paragraph_index);
      },
      [SERVER.LIVE_SCORE]: (message) => onLiveScore(message.player, message.score),
      [SERVER.CURSOR_UPDATE]: (message) => onCursor(message.player, message.x, message.y),
      [SERVER.ANSWER_ACK]: (message) => onAnswerAck(message.answered),
    };

    return engine.subscribe((message) => handlers[message.type]?.(message));
  }, [engine, onGrantItem, onEffect, onScannerResult, onLiveScore, onCursor, onAnswerAck]);
}
