'use client';

// Everyone proposes a topic; the server draws one of them.
//
// The one thing this screen must not do is decide anything. The current one
// does: it sets a local `submitted` flag the moment the form is sent, so a
// ballot the server refused — out of phase, or on a socket that was already
// down — still reads as submitted, and the player waits for a vote they are not
// in. Here "you have voted" is `theme_vote_update.submitted` containing your
// name, which is the server's answer to the same question.
import { decode, topicLabel } from '@wikifake/protocol';
import { Badge, Button, Input, Label, Progress } from '@wikifake/ui';
import { useId, useState, type FormEvent } from 'react';

import type { VoteView } from './use-room.js';

export interface ThemeVoteProps {
  readonly vote: VoteView;
  readonly hasVoted: boolean;
  readonly isHost: boolean;
  onPropose(topic: string): void;
  onForcePick(): void;
}

export function ThemeVote({
  vote,
  hasVoted,
  isHost,
  onPropose,
  onForcePick,
}: ThemeVoteProps) {
  const ids = useId();
  const [topic, setTopic] = useState('');
  const [wrong, setWrong] = useState<string | null>(null);

  const propose = (event: FormEvent): void => {
    event.preventDefault();
    const read = decode(topicLabel, topic);
    if (!read.ok) {
      setWrong(read.issues[0] ?? 'that topic is not allowed');
      return;
    }
    setWrong(null);
    onPropose(read.value);
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-md">
      <h2 className="text-center text-lg font-medium text-ink">Pick a topic</h2>
      <p className="mt-1 text-center text-sm text-muted">
        Everyone proposes one. The server draws the round&rsquo;s.
      </p>

      {hasVoted ? (
        <p className="mt-5 text-center">
          <Badge tone="green">your ballot is in</Badge>
        </p>
      ) : (
        <form onSubmit={propose} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            {/* French, and deliberately: the topics are read from
                fr.wikipedia.org. That is data, not prose of ours. */}
            <Label htmlFor={`${ids}-topic`}>Your topic</Label>
            <Input
              id={`${ids}-topic`}
              value={topic}
              placeholder="Chat"
              onChange={(event) => {
                setTopic(event.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Propose it
          </Button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        <Progress
          value={vote.submitted.length}
          max={Math.max(1, vote.total)}
          aria-label="Ballots in"
        />
        <p className="text-center text-sm text-muted">
          {vote.submitted.length} of {vote.total} have voted
        </p>
      </div>

      {isHost && vote.submitted.length > 0 ? (
        <Button variant="ghost" className="mt-4 w-full" onClick={onForcePick}>
          Draw now
        </Button>
      ) : null}

      {wrong === null ? null : (
        <p role="alert" className="mt-4 text-center text-sm text-danger">
          {wrong}
        </p>
      )}
    </div>
  );
}
