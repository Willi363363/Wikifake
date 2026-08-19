/**
 * ChatPanel — hover-reveal room chat pinned to the right edge. Collapsed, only
 * a vertical CHAT handle (with an unread dot) peeks out; hovering or clicking
 * slides the panel in. Ported from chat.jsx (LobbyChat), now subscribing via
 * useSocketMessages instead of a hand-rolled listener.
 */
import { useState, useEffect, useRef } from 'react';
import { send, useSocketMessages } from '../../lib/ws.js';

export function ChatPanel({ ws, username, roomCode }) {
  const [messages, setMessages] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [unread, setUnread] = useState(0);

  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Listen for messages (the hook keeps the handler in a ref, so it sees fresh `expanded`)
  useSocketMessages(ws, (data) => {
    if (data.type === "chat_message") {
      setMessages(prev => [...prev, data]);
      if (!expanded) setUnread(u => u + 1);
    }
  });

  // Clear unread when expanded
  useEffect(() => {
    if (expanded) setUnread(0);
  }, [expanded]);

  // Auto-scroll
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, expanded]);

  const sendMsg = (e) => {
    if (e) e.preventDefault();
    const txt = inputVal.trim();
    if (!txt || !ws) return;
    send(ws, 'chat_message', { content: txt, sender: username });
    setInputVal("");
    // Focus back on input after send
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        // Only collapse if the input is not focused
        if (document.activeElement !== inputRef.current) {
          setExpanded(false);
        }
      }}
      style={{
        position: "fixed",
        top: "20%",
        bottom: "20%",
        right: expanded ? 24 : -300,
        width: 340,
        zIndex: 9999,
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Handle / Preview edge */}
      <div
        onClick={() => {
          setExpanded(e => !e);
          if (!expanded && inputRef.current) {
             setTimeout(() => inputRef.current.focus(), 50);
          }
        }}
        style={{
          position: "absolute",
          left: -40,
          top: "50%",
          transform: "translateY(-50%)",
          width: 40,
          height: 120,
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--line)",
          borderRight: "none",
          borderRadius: "12px 0 0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: expanded ? "none" : "-4px 0 16px rgba(0,0,0,0.05)",
          opacity: expanded ? 0 : 1,
          pointerEvents: expanded ? "none" : "auto",
        }}
      >
        <span style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "0.1em",
        }}>
          CHAT
        </span>
        {unread > 0 && !expanded && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            width: 10, height: 10, borderRadius: "50%",
            background: "var(--danger)",
            boxShadow: "0 0 0 3px rgba(255,255,255,0.9)",
          }}/>
        )}
      </div>

      {/* Main Panel */}
      <div style={{
        flex: 1,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        opacity: expanded ? 1 : 0.4,
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 0 3px var(--green-soft)",
            }}/>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "var(--ink)" }}>
              Room Chat
            </span>
          </div>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--muted)" }}>
            {roomCode}
          </span>
        </div>

        {/* Message Area */}
        <div style={{
          flex: 1,
          padding: "20px 20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          {messages.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
              Aucun message pour le moment.
            </div>
          ) : (
            messages.map((m, i) => {
              const isMe = m.sender === username;
              return (
                <div key={i} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  gap: 4,
                }}>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "'Geist Mono', monospace", padding: "0 4px" }}>
                    {m.sender}
                  </span>
                  <div style={{
                    background: isMe ? "var(--ink)" : "var(--line)",
                    color: isMe ? "white" : "var(--ink)",
                    padding: "8px 14px",
                    borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    fontSize: 13.5,
                    lineHeight: 1.4,
                    maxWidth: "85%",
                    wordBreak: "break-word",
                  }}>
                    {m.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: "16px",
          borderTop: "1px solid var(--line)",
          background: "rgba(250,249,245,0.5)",
        }}>
          <textarea
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            // The old file had duplicate onFocus/onBlur props (last one won); merged into one of each.
            onFocus={(e) => {
              setExpanded(true);
              e.target.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => e.target.style.borderColor = "var(--line)"}
            placeholder="Type a message..."
            style={{
              width: "100%",
              height: 48,
              background: "white",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13.5,
              resize: "none",
              fontFamily: "inherit",
              outline: "none",
              transition: "border 0.2s",
            }}
          />
        </div>
      </div>
    </div>
  );
}
