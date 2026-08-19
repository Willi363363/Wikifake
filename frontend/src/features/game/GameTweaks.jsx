/**
 * The design-host tweak panel for a live round.
 *
 * Only visible when a design host activates edit mode, so it is invisible in
 * normal play — but `useTweaks` behind it is what actually stores mode,
 * difficulty, accent and which screen is showing.
 */
import {
  TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSelect, TweakButton,
} from '../../vendor/tweaks/index.jsx';

export function GameTweaks({ t, setTweak, onResetMission }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Game" />
      <TweakRadio
        label="Mode"
        value={t.mode}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'expert', label: 'Expert' },
        ]}
        onChange={(v) => setTweak('mode', v)}
      />
      <TweakRadio
        label="Difficulty"
        value={t.difficulty}
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Med' },
          { value: 'hard', label: 'Hard' },
        ]}
        onChange={(v) => setTweak('difficulty', v)}
      />
      <TweakRadio
        label="Screen"
        value={t.gameState}
        options={[
          { value: 'playing', label: 'Playing' },
          { value: 'results', label: 'Debrief' },
        ]}
        onChange={(v) => setTweak('gameState', v)}
      />
      <TweakButton label="↻ Reset mission" onClick={onResetMission} />

      <TweakSection label="Visual" />
      <TweakSelect
        label="Accent"
        value={t.accent}
        options={[
          { value: 'teal', label: 'Verifier teal' },
          { value: 'navy', label: 'Editorial navy' },
          { value: 'bronze', label: 'Bronze hint' },
          { value: 'aubergine', label: 'Aubergine' },
          { value: 'graphite', label: 'Pure graphite' },
        ]}
        onChange={(v) => setTweak('accent', v)}
      />

      <TweakSection label="Multiplayer" />
      <TweakToggle label="Leaderboard" value={t.multiplayer} onChange={(v) => setTweak('multiplayer', v)} />
      <TweakToggle label="Live cursors" value={t.showCursors} onChange={(v) => setTweak('showCursors', v)} />
    </TweaksPanel>
  );
}
