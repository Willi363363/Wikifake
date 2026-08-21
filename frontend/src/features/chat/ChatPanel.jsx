/**
 * Panneau de chat lateral (revele au survol).
 *
 * Recoit un `socket` de `net/socket.js` : il s'abonne proprement et se
 * desabonne au demontage, au lieu de manipuler `ws.addEventListener` avec
 * une dependance sur `expanded` qui rebranchait l'ecouteur en boucle.
 */

import { useEffect, useRef, useState } from 'react';

import { CLIENT, SERVER } from '@/net/protocol';
import { useServerConfig } from '@/state/ServerConfigContext';

function ChatPanel({ socket, username }) {
  const { maxChatLength } = useServerConfig();
  const [messages, setMessages] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  useEffect(() => {
    if (!socket) return undefined;
    return socket.subscribe((message) => {
      if (message.type !== SERVER.CHAT_MESSAGE) return;
      setMessages((prev) => [...prev.slice(-199), message]);
      if (!expandedRef.current) setUnread((count) => count + 1);
    });
  }, [socket]);

  useEffect(() => {
    if (expanded) setUnread(0);
  }, [expanded]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, expanded]);

  const send = (event) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !socket) return;
    socket.send(CLIENT.CHAT_MESSAGE, { content });
    setDraft('');
    inputRef.current?.focus();
  };

  if (!socket) return null;

  return (
    <aside
      className={`chat-panel${expanded ? ' open' : ''}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        if (document.activeElement !== inputRef.current) setExpanded(false);
      }}
    >
      <button
        type="button"
        className="chat-handle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="chat-handle-label">Chat</span>
        {unread > 0 && <span className="chat-unread">{unread}</span>}
      </button>

      <div className="chat-body">
        <header className="chat-header">Discussion</header>
        <div className="chat-messages">
          {messages.length === 0 && <p className="chat-empty">Aucun message pour l&apos;instant.</p>}
          {messages.map((message, index) => (
            <p
              key={`${message.at}-${index}`}
              className={`chat-message${message.sender === username ? ' mine' : ''}`}
            >
              <span className="chat-author">{message.sender}</span>
              {message.content}
            </p>
          ))}
          <span ref={endRef} />
        </div>
        <form className="chat-form" onSubmit={send}>
          <input
            ref={inputRef}
            className="chat-input"
            value={draft}
            maxLength={maxChatLength}
            placeholder="Écrire un message…"
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Message"
          />
          <button type="submit" className="chat-send" disabled={!draft.trim()}>
            ↑
          </button>
        </form>
      </div>
    </aside>
  );
}

export default ChatPanel;
