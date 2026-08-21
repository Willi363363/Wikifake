/**
 * Ecran de jeu — orchestration.
 *
 * Fonctionne a l'identique en solo et en multijoueur : il ne connait que
 * l'interface `engine` (cf. `state/engines.js`). Chaque responsabilite est
 * deleguee a un hook ou un composant : cet ecran ne fait que du cablage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { CURSOR_THROTTLE_MS, SELECTION_SYNC_MS } from '@/config/constants';
import { isSelfTargeted } from '@/config/items';
import { playSound } from '@/lib/sound';
import { useSelection } from '@/state/useSelection';
import { useSettings } from '@/state/SettingsContext';
import { useVisualEffects } from '@/state/useVisualEffects';

import ChatPanel from '@/features/chat/ChatPanel';
import Debrief from '@/features/debrief/Debrief';
import EffectsLayer from '@/features/effects/EffectsLayer';
import RickrollModal from '@/features/effects/RickrollModal';
import FlagLayer from '@/features/flags/FlagLayer';
import { ItemBar, ItemNotification, ItemTargetModal } from '@/features/items';

import ArticleCard from './ArticleCard';
import Brief from './Brief';
import FloatingLeaderboard from './FloatingLeaderboard';
import Footer from './Footer';
import IntelOverlay from './IntelOverlay';
import MissionCard from './MissionCard';
import SettingsPanel from './SettingsPanel';
import SubjectCard from './SubjectCard';
import TopBar from './TopBar';
import { useGameClock } from './useGameClock';
import { useGameplayMessages } from './useGameplayMessages';
import { useIntelTargets, useMyBreakdown, useParticipants } from './useParticipants';

function GameScreen({ engine, leaderboard, solution, soloResult, onLeave, onRestart }) {
  const { settings } = useSettings();
  const selection = useSelection();
  const effects = useVisualEffects();

  const [items, setItems] = useState([]);
  const [pendingItem, setPendingItem] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [liveScores, setLiveScores] = useState({});
  const [cursors, setCursors] = useState({});
  const [answered, setAnswered] = useState(false);
  const [scanned, setScanned] = useState(() => new Set());
  const [hints, setHints] = useState({}); // { targetIndex: { level, hint } }
  const [intelOpen, setIntelOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const finished = Boolean(leaderboard || soloResult);
  const revealed = finished;
  const clock = useGameClock({
    durationS: engine.durationS,
    running: !finished,
    onExpire: () => {
      playSound('game_over');
      submit();
    },
  });

  // ---- reception des messages de gameplay (table dans un hook dedie) ----
  useGameplayMessages({
    engine,
    onGrantItem: useCallback((item) => setItems((prev) => [...prev, item]), []),
    onEffect: useCallback(
      (notification) => {
        setNotifications((prev) => [...prev, notification]);
        setTimeout(
          () => setNotifications((prev) => prev.filter((n) => n.id !== notification.id)),
          notification.expiresIn,
        );
        effects.trigger(notification.itemId);
        if (notification.itemId === 'FREEZE_TIME') clock.subtract(10);
      },
      [effects, clock],
    ),
    onScannerResult: useCallback(
      (index) => setScanned((prev) => new Set(prev).add(index)),
      [],
    ),
    onLiveScore: useCallback(
      (player, score) => setLiveScores((prev) => ({ ...prev, [player]: score })),
      [],
    ),
    onCursor: useCallback(
      (player, x, y) => setCursors((prev) => ({ ...prev, [player]: { x, y } })),
      [],
    ),
    onAnswerAck: useCallback((value) => setAnswered(value), []),
  });

  // ---- synchronisation de la selection (throttlee) ---------------------
  const lastSync = useRef(0);
  useEffect(() => {
    if (finished) return;
    const now = Date.now();
    if (now - lastSync.current < SELECTION_SYNC_MS) return;
    lastSync.current = now;
    engine.updateSelection(selection.indices);
  }, [selection.indices, engine, finished]);

  // ---- curseur partage --------------------------------------------------
  useEffect(() => {
    if (!engine.isMultiplayer || finished || !settings.showCursors) return undefined;
    let last = 0;
    const onMove = (event) => {
      const now = performance.now();
      if (now - last < CURSOR_THROTTLE_MS) return;
      last = now;
      engine.sendCursor(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [engine, finished, settings.showCursors]);

  // ---- actions ----------------------------------------------------------
  const submit = useCallback(() => {
    playSound('success');
    setAnswered(true);
    engine.submit(selection.indices);
  }, [engine, selection.indices]);

  const unsubmit = useCallback(() => {
    setAnswered(false);
    engine.unsubmit();
  }, [engine]);

  const unlockHint = useCallback(
    (targetIndex, level) => {
      playSound('hint');
      engine
        .unlockHint(targetIndex, level)
        .then((payload) => {
          if (!payload) return;
          setHints((prev) => ({
            ...prev,
            [targetIndex]: {
              level: level ?? 1,
              hint: payload.hint,
              paragraphIndex: payload.paragraph_index,
            },
          }));
          if (payload.paragraph_index) {
            setScanned((prev) => new Set(prev).add(payload.paragraph_index));
          }
        })
        .catch(() => {});
    },
    [engine],
  );

  const useItem = useCallback(
    (item) => {
      if (isSelfTargeted(item.item_id)) {
        playSound('item_use');
        engine.useItem(item.instance_id, []);
        setItems((prev) => prev.filter((entry) => entry.instance_id !== item.instance_id));
      } else {
        setPendingItem(item);
      }
    },
    [engine],
  );

  const confirmItem = useCallback(
    (targetName) => {
      if (!pendingItem) return;
      playSound('item_use');
      engine.useItem(pendingItem.instance_id, [targetName]);
      setItems((prev) => prev.filter((entry) => entry.instance_id !== pendingItem.instance_id));
      setPendingItem(null);
    },
    [engine, pendingItem],
  );

  // ---- vues derivees ----------------------------------------------------
  const players = useParticipants({
    leaderboard,
    roster: engine.roster,
    playerName: engine.playerName,
    liveScores,
  });

  const myBreakdown = useMyBreakdown({
    soloResult,
    leaderboard,
    playerName: engine.playerName,
  });

  const effectiveSolution = solution ?? soloResult?.solution ?? null;
  const activeEffectIds = Object.keys(effects.active);
  const totalFakes = engine.article.total_fakes;
  const progress = totalFakes ? Math.min(100, (selection.count / totalFakes) * 100) : 0;

  const intel = useIntelTargets(totalFakes, hints);

  return (
    <div className="app-shell">
      <TopBar
        marked={selection.count}
        total={totalFakes}
        time={clock.remaining}
        progress={progress}
        canSubmit={selection.count > 0 && !answered && !finished}
        waiting={answered && !finished}
        hintsUsed={Object.keys(hints).length}
        onSubmit={submit}
        onUnsubmit={unsubmit}
        onOpenIntel={() => setIntelOpen(true)}
        onOpenBrief={() => setBriefOpen(true)}
        onLogoClick={finished ? onRestart : undefined}
      />

      {briefOpen && (
        <Brief onClose={() => setBriefOpen(false)}>
          <SubjectCard
            facts={[
              { label: 'SUJET', value: engine.article.topic },
              { label: 'SOURCE', value: engine.article.wikipedia_url || 'Wikipédia' },
              { label: 'FALSIFICATIONS', value: String(totalFakes) },
              { label: 'MODE', value: engine.isMultiplayer ? 'MULTIJOUEUR' : 'SOLO', live: true },
            ]}
            fakesTotal={totalFakes}
            fakesMarked={selection.count}
            fakesFound={myBreakdown.hits}
            revealed={revealed}
          />
          <MissionCard
            difficulty={engine.isMultiplayer ? 'multijoueur' : 'solo'}
            total={totalFakes}
          />
        </Brief>
      )}

      <div className="page">
        <ArticleCard
          article={engine.article}
          activeEffectIds={activeEffectIds}
          selection={selection}
          scannedIndices={scanned}
          solution={effectiveSolution}
          revealed={revealed}
          noteMode={settings.expertNotes}
          cursors={cursors}
          roster={players}
          showCursors={engine.isMultiplayer && settings.showCursors && !finished}
          onToggleParagraph={selection.toggle}
          onNoteChange={selection.setNote}
        />
        <Footer sessionId={engine.roomCode ?? 'SOLO'} />
      </div>

      {engine.isMultiplayer && <FloatingLeaderboard players={players.slice(0, 4)} />}
      {engine.socket && <ChatPanel socket={engine.socket} username={engine.playerName} />}

      <EffectsLayer activeIds={activeEffectIds} />
      {effects.isActive('RICKROLL') && <RickrollModal onClose={() => effects.dismiss('RICKROLL')} />}
      <ItemNotification effects={notifications} />

      {!finished && engine.withItems && (
        <ItemBar items={items} onUse={useItem} isMultiplayer={engine.isMultiplayer} />
      )}
      {pendingItem && (
        <ItemTargetModal
          item={pendingItem}
          players={players}
          myName={engine.playerName}
          onConfirm={confirmItem}
          onClose={() => setPendingItem(null)}
        />
      )}

      <IntelOverlay
        open={intelOpen && !effects.isActive('HINT_LOCK')}
        onClose={() => setIntelOpen(false)}
        targets={intel.targets}
        unlocked={intel.levels}
        onUnlock={unlockHint}
      />

      <FlagLayer
        articleTitle={engine.article.topic}
        articleUrl={engine.article.wikipedia_url}
        paragraphs={engine.article.paragraphs.map((paragraph) => paragraph.text)}
        sessionContext={{
          roomCode: engine.roomCode ?? 'solo',
          playerName: engine.playerName,
        }}
        finished={finished}
      />

      {finished && (
        <Debrief
          stats={{
            ...myBreakdown,
            totalFakes,
            timeStr: clock.elapsed,
            sessionId: engine.roomCode ?? 'SOLO',
          }}
          allPlayers={players}
          onRestart={onRestart}
          onExit={onLeave}
        />
      )}

      <SettingsPanel />
    </div>
  );
}

export default GameScreen;
