'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { addNote, getAllNotes } from '../lib/db';
import { runSync } from '../lib/sync';

// ── Status tick helper ───────────────────────────────────────────────────────
// pending  → ⏳  (clock, message saved offline, not sent yet)
// sent     → ✔   (single tick, reached server)
// synced   → ✔✔  (double tick blue, confirmed synced)
function StatusTick({ status }) {
  if (status === 'synced') {
    return <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700 }}>✔✔</span>;
  }
  if (status === 'sent') {
    return <span style={{ color: '#9ca3af', fontSize: 13, fontWeight: 700 }}>✔</span>;
  }
  // pending (default)
  return <span style={{ color: '#f59e0b', fontSize: 13 }}>⏳</span>;
}

export default function Chat() {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|synced|error|offline
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline]   = useState(true);
  const bottomRef                 = useRef(null);

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    const all = await getAllNotes();
    all.sort((a, b) => a.updatedAt - b.updatedAt); // oldest first (chat order)
    setMessages(all);
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Online / Offline listeners ─────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setSyncStatus('idle'); handleSync(); };
    const goOffline = () => { setIsOnline(false); setSyncStatus('offline'); };
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) setSyncStatus('offline');
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;

    const msg = {
      id: crypto.randomUUID(),
      content,
      updatedAt: Date.now(),
      synced: false,
      status: 'pending',
    };

    await addNote(msg);
    setInput('');
    await loadMessages();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Sync ───────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    if (isSyncing) return;
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('syncing');
    try {
      await runSync();
      await loadMessages();
      setSyncStatus('synced');
    } catch (err) {
      if (err.message === 'OFFLINE') {
        setSyncStatus('offline');
      } else {
        console.error('Sync error:', err);
        setSyncStatus('error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Status bar ─────────────────────────────────────────────────────────────
  const statusBar = () => {
    const map = {
      offline: { bg: '#fef2f2', color: '#dc2626', text: '🔴 Offline — messages saved locally' },
      syncing: { bg: '#fffbeb', color: '#b45309', text: '🔄 Syncing…' },
      synced:  { bg: '#f0fdf4', color: '#15803d', text: '🟢 All messages synced' },
      error:   { bg: '#fef2f2', color: '#dc2626', text: '⚠️ Sync failed — will retry when online' },
    };
    const s = map[syncStatus];
    if (!s) return null;
    return (
      <div style={{ background: s.bg, color: s.color, fontSize: 12, fontWeight: 600,
                    padding: '6px 16px', textAlign: 'center', borderBottom: `1px solid ${s.bg}` }}>
        {s.text}
      </div>
    );
  };

  return (
    <div style={S.shell}>
      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.avatar}>OX</div>
        <div>
          <div style={S.headerName}>OfflineX</div>
          <div style={S.headerSub}>
            {isOnline
              ? <span style={{ color: '#4ade80' }}>● online</span>
              : <span style={{ color: '#f87171' }}>● offline</span>}
          </div>
        </div>
        <button
          style={{ ...S.syncBtn, marginLeft: 'auto', opacity: isSyncing || !isOnline ? 0.55 : 1 }}
          onClick={handleSync}
          disabled={isSyncing || !isOnline}
          title={!isOnline ? 'You are offline' : 'Sync messages'}
        >
          {isSyncing ? '🔄' : '⚡'} Sync
        </button>
      </header>

      {/* ── Status bar ── */}
      {statusBar()}

      {/* ── Message list ── */}
      <div style={S.messageList}>
        {messages.length === 0 && (
          <div style={S.empty}>No messages yet. Say something! 👋</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={S.bubbleRow}>
            <div style={{
              ...S.bubble,
              opacity: msg.status === 'pending' ? 0.72 : 1,
            }}>
              <span style={S.bubbleText}>{msg.content}</span>
              <span style={S.bubbleMeta}>
                {formatTime(msg.updatedAt)}
                &nbsp;
                <StatusTick status={msg.status || (msg.synced ? 'synced' : 'pending')} />
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={S.inputBar}>
        <input
          style={S.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
        />
        <button style={S.sendBtn} onClick={handleSend}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: 620,
    height: '100vh',
    margin: '0 auto',
    background: '#ffffff',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    boxShadow: '0 0 40px rgba(0,0,0,0.08)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    background: '#1e293b',
    color: '#fff',
    flexShrink: 0,
  },
  avatar: {
    width: 40, height: 40,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0,
  },
  headerName: { fontWeight: 700, fontSize: 16 },
  headerSub:  { fontSize: 12, marginTop: 1 },
  syncBtn: {
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 20,
    cursor: 'pointer',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 14px',
    background: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  bubbleRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  bubble: {
    background: '#2563eb',
    color: '#fff',
    padding: '10px 14px 6px',
    borderRadius: '18px 18px 4px 18px',
    maxWidth: '72%',
    wordBreak: 'break-word',
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 1.45 },
  bubbleMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 3,
  },
  inputBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 14px',
    background: '#fff',
    borderTop: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '11px 16px',
    fontSize: 15,
    borderRadius: 24,
    border: '1.5px solid #e2e8f0',
    outline: 'none',
    background: '#f8fafc',
  },
  sendBtn: {
    width: 44, height: 44,
    borderRadius: '50%',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 60,
    fontSize: 15,
  },
};