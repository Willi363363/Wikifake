/**
 * All the transient malus state in one hook.
 *
 * The legacy app kept ~12 useState + setTimeout pairs inside InnerApp; this
 * hook owns them so the page component only wires flags to overlays. The
 * caller feeds raw `item_effect` websocket messages into applyEffect() —
 * the socket itself stays outside. Timings are copied verbatim from the
 * legacy handler; two effects need the caller because their targets live
 * elsewhere: FREEZE_TIME steals clock time (onStealTime) and SCORE_STEAL
 * steals points (onScoreStolen).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { playSound } from '../../lib/sound';
import { itemDef } from './catalog';

export function useItemEffects({ onStealTime, onScoreStolen }) {
  // Toasts for <ItemNotification />: [{id, icon, name, from}]
  const [notifications, setNotifications] = useState([]);

  // One boolean per visual malus.
  const [blur, setBlur] = useState(false);
  const [timeFrozen, setTimeFrozen] = useState(false);
  const [hintLocked, setHintLocked] = useState(false);
  const [lightning, setLightning] = useState(false);
  const [earthquake, setEarthquake] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [rickroll, setRickroll] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [tiny, setTiny] = useState(false);
  const [spin, setSpin] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [invert, setInvert] = useState(false);

  // SCANNER has no overlay: it bumps a counter the article page reacts to.
  const [scannerTrigger, setScannerTrigger] = useState(0);

  // Keep the latest callbacks without making applyEffect unstable.
  const onStealTimeRef = useRef(onStealTime);
  const onScoreStolenRef = useRef(onScoreStolen);
  useEffect(() => {
    onStealTimeRef.current = onStealTime;
    onScoreStolenRef.current = onScoreStolen;
  });

  // Every timeout is tracked so unmount never fires a setState on a dead tree.
  const timeoutsRef = useRef(new Set());
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, ms);
    timeoutsRef.current.add(id);
  }, []);
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);

  const applyEffect = useCallback((msg) => {
    playSound('malus');

    // Toast — visible 4s, same id scheme as the legacy handler.
    const effectId = Date.now() + Math.random();
    const def = itemDef(msg.item_id);
    setNotifications(prev => [...prev, {
      id: effectId,
      icon: msg.item_icon || def.icon,
      name: msg.item_name || def.name,
      from: msg.from,
    }]);
    later(() => setNotifications(prev => prev.filter(e => e.id !== effectId)), 4000);

    if (msg.item_id === "BLUR") {
      setBlur(true);
      later(() => setBlur(false), 5000);
    } else if (msg.item_id === "FREEZE_TIME") {
      onStealTimeRef.current && onStealTimeRef.current(10);
      setTimeFrozen(true);
      later(() => setTimeFrozen(false), 3000); // visuel 3s seulement
    } else if (msg.item_id === "HINT_LOCK") {
      setHintLocked(true);
      later(() => setHintLocked(false), 20000);
    } else if (msg.item_id === "SCORE_STEAL") {
      onScoreStolenRef.current && onScoreStolenRef.current(50);
      setLightning(true);
      later(() => setLightning(false), 3000);
    } else if (msg.item_id === "BLACKOUT") {
      setBlackout(true);
      later(() => setBlackout(false), 5000);
    } else if (msg.item_id === "EARTHQUAKE") {
      setEarthquake(true);
      later(() => setEarthquake(false), 5000);
    } else if (msg.item_id === "RICKROLL") {
      setRickroll(true); // stays until dismissed
    } else if (msg.item_id === "SCANNER") {
      setScannerTrigger(prev => prev + 1);
    } else if (msg.item_id === "MIRROR") {
      setMirror(true);
      later(() => setMirror(false), 6000);
    } else if (msg.item_id === "TINY") {
      setTiny(true);
      later(() => setTiny(false), 8000);
    } else if (msg.item_id === "SPIN") {
      setSpin(true);
      later(() => setSpin(false), 4000);
    } else if (msg.item_id === "CONFETTI") {
      setConfetti(true);
      later(() => setConfetti(false), 6000);
    } else if (msg.item_id === "INVERT") {
      setInvert(true);
      later(() => setInvert(false), 5000);
    }
  }, [later]);

  const dismissRickroll = useCallback(() => setRickroll(false), []);

  return {
    applyEffect,
    notifications,
    flags: { blur, hintLocked, lightning, earthquake, blackout, rickroll, mirror, tiny, spin, confetti, invert, timeFrozen },
    scannerTrigger,
    dismissRickroll,
  };
}
