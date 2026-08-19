/**
 * A live round.
 *
 * This is the orchestrator: it wires the article, the countdown, the hint
 * economy, the item malus and the room socket together, then hands each slice
 * to the feature that renders it. Deliberately the only place that knows about
 * all of them at once — every other file here stays single-purpose.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { GAME_DURATION, NEUTRAL_PLAYER_COLOR, TWEAK_DEFAULTS } from '../../config.js';
import { playSound } from '../../lib/sound.js';
import { send, useSocketMessages } from '../../lib/ws.js';
import { articleUrl } from '../../lib/article.js';
import { useTweaks } from '../../vendor/tweaks/index.jsx';
import { useAccent, accentColor } from '../../app/useAccent.js';

// Imported file-by-file rather than through ./index.js: the barrel re-exports
// GameSession itself, and going through it would make the cycle load-order dependent.
import { TopBar } from './TopBar.jsx';
import { SubjectCard } from './SubjectCard.jsx';
import { MissionCard } from './MissionCard.jsx';
import { Footer } from './Footer.jsx';
import { Brief } from './Brief.jsx';
import { IntelOverlay } from './IntelOverlay.jsx';
import { ArticleCard } from './ArticleCard.jsx';
import { GameTweaks } from './GameTweaks.jsx';
import { HintLockedNotice } from './HintLockedNotice.jsx';
import { useSelection } from './useSelection.js';
import { useTimer } from './useTimer.js';
import { useHints } from './useHints.js';
import { useScore, useLiveScore } from './useScore.js';
import { useLiveCursors } from './useLiveCursors.js';

import { ItemBar, ItemTargetModal, ItemNotification, isSelfCast } from '../items/index.js';
import { Blizzard, Lightning, Static, Fog, Earthquake, Blackout, Confetti, Rickroll } from '../items/effects/index.js';
import { useItemEffects } from '../items/useItemEffects.js';
import { FloatingLeaderboard, PlayerCursor } from '../leaderboard/index.js';
import { Debrief } from '../debrief/index.js';
import { ChatPanel } from '../chat/index.js';
import { FlagButton, FlagCaptureModal, FlagToast, FlagReportForm } from '../flag/index.js';

export function GameSession({ session, onEndRound }) {
  const { article, multiplayer } = session;
  const socket = multiplayer?.socket || null;
  const me = multiplayer?.username;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useAccent(t.accent);

  const [revealAll, setRevealAll] = useState(false);
  const [scoreStolen, setScoreStolen] = useState(0);
  const [items, setItems] = useState([]);
  const [itemModal, setItemModal] = useState(null);
  const [scannedParagraphs, setScannedParagraphs] = useState(() => new Set());

  const [intelOpen, setIntelOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const [leaderboard, setLeaderboard] = useState(null);
  const [waitingForOthers, setWaitingForOthers] = useState(false);
  const [liveScores, setLiveScores] = useState({});

  const [flaggedItems, setFlaggedItems] = useState([]);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagToastOpen, setFlagToastOpen] = useState(false);
  const [flagReportDone, setFlagReportDone] = useState(false);

  const articleRef = useRef(null);

  const playing = t.gameState === 'playing' && !revealAll;

  const [time, setTime] = useTimer(session.timeLimit || GAME_DURATION, playing);
  const selection = useSelection(t.mode, revealAll);
  const hints = useHints(article.fakes);
  const { cursors, trackCursor } = useLiveCursors(socket, playing);

  const effects = useItemEffects({
    onStealTime: (seconds) => setTime((prev) => Math.max(0, prev - seconds)),
    onScoreStolen: (points) => setScoreStolen((prev) => prev + points),
  });

  const stats = useScore({
    marked: selection.marked,
    edited: selection.edited,
    fakes: article.fakes,
    time,
    hintPenalty: hints.hintPenalty,
    scoreStolen,
    sessionId: t.sessionId,
  });
  const liveScore = useLiveScore({ markedCount: selection.markedCount, hintPenalty: hints.hintPenalty });

  // ---- Submission -----------------------------------------------------------

  const submit = useCallback(() => {
    playSound('success');
    if (socket) {
      send(socket, 'submit_answer', {
        answers: selection.answerIndices,
        hintsUsed: hints.hintsUsed,
        hintPenalty: hints.hintPenalty,
        scoreStolen,
      });
      setWaitingForOthers(true);
      return;
    }
    setRevealAll(true);
    setTimeout(() => setTweak('gameState', 'results'), 600);
  }, [socket, selection.answerIndices, hints.hintsUsed, hints.hintPenalty, scoreStolen, setTweak]);

  const unsubmit = useCallback(() => {
    if (!socket) return;
    send(socket, 'unsubmit_answer');
    setWaitingForOthers(false);
  }, [socket]);

  // The clock running out submits whatever the player has so far.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (time === 0 && playing) {
      playSound('game_over');
      submitRef.current();
    }
  }, [time, playing]);

  // ---- Room messages --------------------------------------------------------

  useSocketMessages(socket, (msg) => {
    switch (msg.type) {
      case 'game_end':
        setWaitingForOthers(false);
        setLeaderboard(msg.leaderboard);
        setRevealAll(true);
        setTimeout(() => setTweak('gameState', 'results'), 600);
        break;
      case 'live_score_update':
        setLiveScores((prev) => ({ ...prev, [msg.player]: msg.score }));
        break;
      case 'cursor_update':
        trackCursor(msg.player, msg.x, msg.y);
        break;
      case 'items_distributed': {
        const mine = msg.items[me];
        if (mine) {
          playSound('item_receive');
          setItems((prev) => [...prev, mine]);
        }
        break;
      }
      case 'item_effect':
        effects.applyEffect(msg);
        break;
      default:
        break;
    }
  });

  // Broadcast our optimistic score so rivals see a live ranking.
  useEffect(() => {
    if (socket && t.gameState === 'playing') send(socket, 'live_score', { score: liveScore });
  }, [socket, liveScore, t.gameState]);

  // The Détecteur reveals one still-unfound sabotaged paragraph.
  useEffect(() => {
    if (effects.scannerTrigger === 0) return;
    setScannedParagraphs((prev) => {
      const candidates = article.fakes
        .map((f) => f.tokenId)
        .filter((id) => !selection.marked[id] && !selection.edited[id] && !prev.has(id));
      if (candidates.length === 0) return prev;
      playSound('scanner');
      return new Set([...prev, candidates[Math.floor(Math.random() * candidates.length)]]);
    });
    // Intentionally keyed on the trigger alone: a re-scan only happens on a new item use.
  }, [effects.scannerTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Items ----------------------------------------------------------------

  const useItem = useCallback((item) => {
    if (!socket) return;
    if (isSelfCast(item.id)) {
      playSound('item_use');
      send(socket, 'use_item', { instance_id: item.instance_id, targets: [me] });
      setItems((prev) => prev.filter((it) => it.instance_id !== item.instance_id));
      return;
    }
    setItemModal(item);
  }, [socket, me]);

  const confirmUseItem = useCallback((targetName) => {
    if (!itemModal || !socket) return;
    playSound('item_use');
    send(socket, 'use_item', { instance_id: itemModal.instance_id, targets: [targetName] });
    setItems((prev) => prev.filter((it) => it.instance_id !== itemModal.instance_id));
    setItemModal(null);
  }, [itemModal, socket]);

  // ---- Scoreboard -----------------------------------------------------------

  const players = useMemo(() => {
    const mine = accentColor(t.accent);

    if (leaderboard) {
      return leaderboard.map((p) => ({
        ...p,
        color: p.color || (p.name === me ? mine : NEUTRAL_PLAYER_COLOR),
        you: p.name === me,
      }));
    }

    if (multiplayer && session.players) {
      return session.players
        .map((p) => {
          const name = typeof p === 'string' ? p : p.name;
          const color = typeof p === 'string' ? null : p.color;
          const isMe = name === me;
          return {
            id: name,
            name,
            color: color || (isMe ? mine : NEUTRAL_PLAYER_COLOR),
            score: isMe ? liveScore : (liveScores[name] || 0),
            you: isMe,
          };
        })
        .sort((a, b) => b.score - a.score);
    }

    return [{ id: 'you', name: me || 'You', color: mine, score: liveScore, you: true }];
  }, [leaderboard, liveScore, t.accent, multiplayer, session.players, liveScores, me]);

  // ---- Render ---------------------------------------------------------------

  const totalFakes = article.fakes.length;
  const progress = Math.min(100, (selection.markedCount / totalFakes) * 100);

  const restart = (kind) => {
    if (kind === 'new') {
      onEndRound();
      return;
    }
    setTweak({ ...t, gameState: 'playing' });
    setRevealAll(true);
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <TopBar
        mode={t.mode}
        marked={selection.markedCount}
        total={totalFakes}
        time={time}
        onSubmit={submit}
        onUnsubmit={unsubmit}
        target={article.title}
        progress={progress}
        canSubmit={selection.markedCount > 0 && !waitingForOthers && !revealAll}
        waiting={waitingForOthers}
        onOpenIntel={() => setIntelOpen(true)}
        onOpenBrief={() => setBriefOpen(true)}
        hintsUsed={hints.hintsUsed}
        onLogoClick={revealAll ? onEndRound : undefined}
      />

      {briefOpen && (
        <Brief onClose={() => setBriefOpen(false)}>
          <SubjectCard
            facts={article.infobox}
            fakesTotal={totalFakes}
            fakesMarked={selection.markedCount}
            fakesFound={selection.markedCount}
            revealed={revealAll}
          />
          <MissionCard
            difficulty={t.difficulty}
            mode={t.mode}
            room={t.sessionId}
            total={totalFakes}
          />
        </Brief>
      )}

      <div style={{
        maxWidth: 920, margin: '26px auto 0',
        padding: '0 28px',
        position: 'relative',
        zIndex: 1,
        transition: 'padding-right 360ms cubic-bezier(.2,.6,.2,1)',
      }}>
        <ArticleCard
          article={article}
          articleRef={articleRef}
          marked={selection.marked}
          edited={selection.edited}
          mode={t.mode}
          hintedTokenIds={hints.hintedTokenIds}
          scannedParagraphs={scannedParagraphs}
          onTokenClick={selection.onTokenClick}
          onTokenEdit={selection.onTokenEdit}
          revealAll={revealAll}
          effects={effects.flags}
        >
          {t.multiplayer && t.showCursors && playing && Object.entries(cursors).map(([name, cursor]) => {
            const player = players.find((p) => p.name === name);
            if (!player || player.you) return null;
            return (
              <PlayerCursor
                key={name}
                x={cursor.x * window.innerWidth}
                y={cursor.y * window.innerHeight}
                name={name}
                color={player.color}
              />
            );
          })}
        </ArticleCard>

        <Footer sessionId={t.sessionId} />
      </div>

      {socket && (
        <ChatPanel ws={socket} username={me} roomCode={multiplayer.roomCode} />
      )}

      {t.multiplayer && <FloatingLeaderboard players={players.slice(0, 4)} />}

      <Blizzard active={effects.flags.timeFrozen} />
      <Lightning active={effects.flags.lightning} />
      <Static active={effects.flags.hintLocked} />
      <Fog active={effects.flags.blur} />
      <Earthquake active={effects.flags.earthquake} />
      <Blackout active={effects.flags.blackout} />
      <Confetti active={effects.flags.confetti} />
      <Rickroll active={effects.flags.rickroll} onClose={effects.dismissRickroll} />

      {playing && session.withItems && (
        <ItemBar items={items} onUse={useItem} isMultiplayer={!!multiplayer} />
      )}

      {itemModal && (
        <ItemTargetModal
          item={itemModal}
          players={players}
          myName={me}
          onConfirm={confirmUseItem}
          onClose={() => setItemModal(null)}
        />
      )}

      <ItemNotification effects={effects.notifications} />

      <IntelOverlay
        open={intelOpen && !effects.flags.hintLocked}
        onClose={() => setIntelOpen(false)}
        targets={article.fakes}
        unlocked={hints.unlocks}
        onUnlock={hints.unlock}
      />
      {effects.flags.hintLocked && intelOpen && (
        <HintLockedNotice onClose={() => setIntelOpen(false)} />
      )}

      {t.gameState === 'results' && (
        <Debrief
          stats={stats}
          onRestart={restart}
          mode={t.mode}
          allPlayers={players.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            you: p.you,
            breakdown: p.breakdown || {
              tp: stats.truePositives,
              fp: stats.falsePositives,
              hintsUsed: hints.hintsUsed,
              hintPenalty: hints.hintPenalty,
              timeBonus: stats.timeBonus,
            },
          }))}
        />
      )}

      {playing && (
        <FlagButton onClick={() => setFlagModalOpen(true)} count={flaggedItems.length} />
      )}
      {flagModalOpen && (
        <FlagCaptureModal
          article={article}
          articleTitle={article.title}
          onSubmit={(item) => {
            setFlaggedItems((prev) => [...prev, item]);
            setFlagModalOpen(false);
            setFlagToastOpen(true);
          }}
          onClose={() => setFlagModalOpen(false)}
        />
      )}
      {flagToastOpen && <FlagToast onDone={() => setFlagToastOpen(false)} />}
      {t.gameState === 'results' && flaggedItems.length > 0 && !flagReportDone && (
        <FlagReportForm
          flaggedItems={flaggedItems}
          articleTitle={article.title}
          articleUrl={articleUrl(article)}
          sessionContext={{
            roomCode: multiplayer?.roomCode || 'solo',
            playerName: me || 'anonymous',
          }}
          onDone={() => setFlagReportDone(true)}
        />
      )}

      <GameTweaks t={t} setTweak={setTweak} onResetMission={() => restart('new')} />
    </div>
  );
}
