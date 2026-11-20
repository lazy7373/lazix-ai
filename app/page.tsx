"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Message = { role: "user" | "assistant"; content: string };
type Memory = { id: string; content: string; created_at: string };
type ModelOption = { id: string; label: string; model: string };
type IntegrationStatus = { webSearch: boolean; githubRead: boolean };
type Thread = { id: string; title: string; messages: Message[]; updatedAt: number };
const CHAT_KEY = "lazix-chat-v2";
const AUTO_KEY = "lazix-auto-memory";
const THREAD_KEY = "lazix-threads-v1";
const supabase = getSupabaseBrowserClient();

const starters = [
  { icon: "✳", title: "Explore an idea", prompt: "Help me explore an idea and turn it into a practical plan." },
  { icon: "⌘", title: "Build something", prompt: "Help me plan and build a software project step by step." },
  { icon: "◎", title: "Learn a topic", prompt: "Teach me a topic from the basics with clear examples." },
  { icon: "↗", title: "Solve a problem", prompt: "Help me break down a problem and find the best solution." }
];

function MessageContent({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    pre: ({ children }) => <pre className="markdown-code">{children}</pre>
  }}>{content}</ReactMarkdown>;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryInput, setMemoryInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [autoMemory, setAutoMemory] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [integrations, setIntegrations] = useState<IntegrationStatus>({ webSearch: false, githubRead: false });
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  activeThreadIdRef.current = activeThreadId;

  useEffect(() => {
    try {
      const savedThreads = localStorage.getItem(THREAD_KEY);
      if (savedThreads) {
        const parsed = JSON.parse(savedThreads) as Thread[];
        if (Array.isArray(parsed)) {
          setThreads(parsed);
          const activeId = localStorage.getItem("lazix-active-thread");
          const active = parsed.find((thread) => thread.id === activeId) || [...parsed].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          if (active) { setActiveThreadId(active.id); setMessages(active.messages); }
        }
      } else {
        const saved = localStorage.getItem(CHAT_KEY);
        if (saved) setMessages(JSON.parse(saved) as Message[]);
      }
      setAutoMemory(localStorage.getItem(AUTO_KEY) !== "false");
    } catch { localStorage.removeItem(CHAT_KEY); localStorage.removeItem(THREAD_KEY); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setNotice("");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetch("/api/models", { headers: session?.access_token ? { Authorization: "Bearer " + session.access_token } : {} })
      .then((response) => response.json())
      .then((data: { models?: ModelOption[]; integrations?: IntegrationStatus }) => {
        const available = Array.isArray(data.models) ? data.models : [];
        setModels(available);
        if (available.length) setSelectedModel((current) => current || available[0].id);
        if (data.integrations) setIntegrations(data.integrations);
      })
      .catch(() => setModels([]));
  }, [session?.access_token]);
  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    fetch("/api/conversations", { headers: { Authorization: "Bearer " + session.access_token } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Cloud history is unavailable.");
        return data as { conversations?: { id: string; title: string; updated_at: string; messages: Message[] }[] };
      })
      .then((data) => {
        if (!active || !Array.isArray(data.conversations)) return;
        const remote = data.conversations.map((item) => ({ id: item.id, title: item.title, messages: item.messages || [], updatedAt: new Date(item.updated_at).getTime() }));
        setThreads((current) => {
          const byId = new Map(current.map((thread) => [thread.id, thread]));
          for (const thread of remote) {
            const local = byId.get(thread.id);
            if (!local || thread.updatedAt >= local.updatedAt) byId.set(thread.id, thread);
          }
          const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
          localStorage.setItem(THREAD_KEY, JSON.stringify(merged));
          return merged;
        });
        if (!activeThreadIdRef.current && remote.length) { setActiveThreadId(remote[0].id); setMessages(remote[0].messages); }
      })
      .catch((error) => { if (active) setNotice(error.message || "Could not sync conversation history."); });
    return () => { active = false; };
  }, [session?.access_token]);
  useEffect(() => {
    if (!session?.access_token) { setMemories([]); return; }
    let active = true;
    fetch("/api/memory", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); if (active) setMemories(data.memories || []); })
      .catch((error) => { if (active) setNotice(error.message || "Could not load memory."); });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-100)));
      if (activeThreadId) localStorage.setItem("lazix-active-thread", activeThreadId);
      if (messages.length) {
        const firstUser = messages.find((message) => message.role === "user")?.content || "New conversation";
        const threadId = activeThreadId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
        setThreads((current) => {
          const existing = current.find((thread) => thread.id === threadId);
          const updated: Thread = { id: threadId, title: existing?.title || firstUser.slice(0, 42), messages: messages.slice(-100), updatedAt: Date.now() };
          const next = [updated, ...current.filter((thread) => thread.id !== threadId)].slice(0, 30);
          localStorage.setItem(THREAD_KEY, JSON.stringify(next));
          if (!activeThreadId) { setActiveThreadId(threadId); localStorage.setItem("lazix-active-thread", threadId); }
          return next;
        });
      }
    }, 350);
    endRef.current?.scrollIntoView({ behavior: "auto" });
    return () => window.clearTimeout(timer);
  }, [messages, ready, activeThreadId]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true); setNotice("");
    try {
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setNotice(authMode === "signup" && !result.data.session ? "Check your email to confirm your account." : "You're signed in. Memory is ready.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Authentication failed."); }
    finally { setAuthBusy(false); }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut(); setMemories([]); setNotice("Signed out.");
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memoryInput.trim() || !session || memoryBusy) return;
    setMemoryBusy(true); setNotice("");
    try {
      const response = await fetch("/api/memory", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content: memoryInput.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save memory.");
      setMemories((current) => [data.memory, ...current]); setMemoryInput(""); setNotice("Saved to permanent memory.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save memory."); }
    finally { setMemoryBusy(false); }
  }

  async function deleteMemory(id: string) {
    if (!session) return;
    const response = await fetch(`/api/memory?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "Could not delete memory."); return; }
    setMemories((items) => items.filter((item) => item.id !== id));
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>, textOverride?: string) {
    event?.preventDefault();
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    const threadId = activeThreadId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
    if (!activeThreadId) setActiveThreadId(threadId);
    setMessages(next); setInput(""); setBusy(true); setNotice("");
    let assistantText = "";
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ messages: next.slice(-100), autoMemory, modelId: selectedModel || undefined }),
        signal: controller.signal
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "The request failed." }));
        throw new Error(data.error || "The request failed.");
      }
      if (!response.body) throw new Error("Streaming is not available in this browser.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handleEvent = (raw: string) => {
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) return;
        const payload = JSON.parse(dataLines.join("\n")) as { text?: string; model?: string; modelId?: string; label?: string; error?: string; message?: string; name?: string };
        if (eventName === "meta") setModel(payload.label || payload.model || "LAZIX");
        if (eventName === "delta" && typeof payload.text === "string") {
          assistantText += payload.text;
          setMessages([...next, { role: "assistant", content: assistantText }]);
        }
        if (eventName === "tool") setNotice("LAZIX is using " + (payload.name || "a tool") + "...");
        if (eventName === "done") setNotice("");
        if (eventName === "provider_fallback") setNotice(payload.message || "Switching to backup model...");
        if (eventName === "error") throw new Error(payload.error || "AI provider failed.");
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const raw of events) handleEvent(raw);
      }
      if (buffer.trim()) handleEvent(buffer);
      if (!assistantText.trim()) throw new Error("The model returned an empty response. Try another model.");
      if (session?.access_token) {
        const title = next.find((message) => message.role === "user")?.content.slice(0, 42) || "New conversation";
        void fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ id: threadId, title, messages: [...next, { role: "assistant", content: assistantText }].slice(-100) })
        }).then(async (saved) => {
          if (!saved.ok) { const data = await saved.json().catch(() => ({})); setNotice(data.error || "Conversation is saved on this device; cloud sync needs setup."); }
        }).catch(() => setNotice("Conversation is saved on this device; cloud sync is unavailable."));
      }
      if (session?.access_token && autoMemory) {
        window.setTimeout(async () => {
          try {
            const r = await fetch("/api/memory", { headers: { Authorization: `Bearer ${session.access_token}` } });
            if (r.ok) { const d = await r.json(); setMemories(d.memories || []); }
          } catch { /* best effort */ }
        }, 12000);
      }
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "Generation stopped." : error instanceof Error ? error.message : "Something went wrong.";
      setMessages([...next, { role: "assistant", content: assistantText ? `${assistantText}\\n\\n[Connection interrupted: ${message}]` : message }]);
    } finally { abortRef.current = null; setBusy(false); }
  }

  function stopGeneration() { abortRef.current?.abort(); }

  function openThread(thread: Thread) {
    if (busy) return;
    setActiveThreadId(thread.id);
    localStorage.setItem("lazix-active-thread", thread.id);
    setMessages(thread.messages);
    setMemoryOpen(false);
    setSidebarOpen(false);
  }

  function newChat() {
    if (busy) return;
    setMessages([]);
    setActiveThreadId(null);
    localStorage.removeItem(CHAT_KEY);
    localStorage.removeItem("lazix-active-thread");
    setSidebarOpen(false);
    setMemoryOpen(false);
    inputRef.current?.focus();
  }

  return (
    <main className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="side-brand"><div className="logo-mark">L</div><span>LAZIX</span><span className="version-pill">BETA</span></div>
        <button className="new-chat" onClick={newChat}><span>＋</span> New conversation</button>
        <div className="side-label">WORKSPACE</div>
        <button className={`nav-item ${!memoryOpen ? "active" : ""}`} onClick={() => { setMemoryOpen(false); setSidebarOpen(false); }}><span>◫</span> Chat</button>
        <div className="side-label thread-heading">RECENT</div>
        <div className="thread-list">
          {threads.slice(0, 18).map((thread) => <button key={thread.id} className={"thread-item " + (thread.id === activeThreadId ? "thread-active" : "")} onClick={() => openThread(thread)} title={thread.title}><span>▤</span><b>{thread.title}</b></button>)}
        </div>
        <button className={`nav-item ${memoryOpen ? "active" : ""}`} onClick={() => { setMemoryOpen(!memoryOpen); setSidebarOpen(false); }}><span>◈</span> Memory <span className="nav-count">{memories.length}</span></button>
        <div className="side-spacer" />
        <div className="agent-status"><span className="online-dot" /><div><b>Agent engine</b><small>{integrations.webSearch ? "Web research" : "Core tools"}{integrations.githubRead ? " · GitHub connected" : ""}</small></div></div>
        <div className="side-account">
          {session ? <><div className="avatar">{(session.user.email || "U").slice(0, 1).toUpperCase()}</div><div className="account-copy"><b>{session.user.email}</b><small>Personal workspace</small></div><button className="icon-button" title="Sign out" onClick={signOut}>↗</button></> :
            <div className="account-copy"><b>Guest workspace</b><small>Sign in to sync memory</small></div>}
        </div>
      </aside>

      <section className="main-area">
        <header className="main-header">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className="breadcrumb"><span>Workspace</span><i>/</i><b>{memoryOpen ? "Memory" : "Assistant"}</b></div>
          <div className="header-right"><span className="secure-label"><i /> PRIVATE SESSION</span><button className="header-new" onClick={newChat}>＋ <span>New chat</span></button></div>
        </header>

        {memoryOpen ? (
          <div className="memory-page">
            <div className="page-kicker">PERSONAL CONTEXT</div><h1>Your memory.</h1><p className="page-subtitle">A private knowledge layer that helps LAZIX remember what matters across conversations.</p>
            <div className="memory-settings-card">
              <div><b>Automatic memory</b><small>Let LAZIX remember useful, durable details from your chats.</small></div>
              <label className="switch"><input type="checkbox" checked={autoMemory} onChange={(e) => { setAutoMemory(e.target.checked); localStorage.setItem(AUTO_KEY, String(e.target.checked)); }} /><span /></label>
            </div>
            {!isSupabaseConfigured() ? <p className="inline-note">Supabase is not configured yet.</p> : !session ? (
              <div className="auth-card"><div className="auth-heading"><b>{authMode === "signin" ? "Welcome back" : "Create your account"}</b><span>Sign in to keep your memory private and synced.</span></div>
                <form onSubmit={handleAuth}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min. 6 characters)" minLength={6} required /><button className="primary-button" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "signin" ? "Sign in" : "Create account"}</button></form>
                <button className="text-button" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>{authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
              </div>
            ) : <>
              <form className="memory-add" onSubmit={saveMemory}><input value={memoryInput} onChange={(e) => setMemoryInput(e.target.value)} placeholder="Add a fact, preference, or project for LAZIX to remember..." maxLength={2000} /><button className="primary-button" disabled={memoryBusy || !memoryInput.trim()}>{memoryBusy ? "Saving..." : "Add memory"}</button></form>
              <div className="memory-list-head"><b>Saved memories</b><span>{memories.length} items</span></div>
              <div className="memory-collection">{memories.length ? memories.map((memory) => <div className="memory-row" key={memory.id}><span className="memory-glyph">◈</span><p>{memory.content}</p><button onClick={() => deleteMemory(memory.id)} aria-label="Delete memory">×</button></div>) : <div className="memory-empty"><span>◈</span><b>Your memory is a blank canvas.</b><small>Save a detail here or turn on automatic memory while chatting.</small></div>}</div>
            </>}
            {notice && <p className="inline-note">{notice}</p>}
          </div>
        ) : (
          <div className="chat-layout">
            {!messages.length && <div className="chat-intro">
              <div className="page-kicker"><span className="sparkle">✳</span> YOUR PERSONAL AI</div>
              <h1>A little more<br /><em>possibility.</em></h1>
              <p>Think clearly. Build boldly. Let’s get things moving.</p>
            </div>}
            <div className="conversation-panel">
              <div className="conversation-top"><div><span className="live-indicator" /><b>LAZIX</b><small>Personal AI assistant</small></div><div className="model-picker-wrap"><span className="model-live-dot" /><select className="model-picker" aria-label="Choose AI model" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} disabled={busy || models.length < 2}>{models.length ? models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>) : <option value="">Connect a model</option>}</select>{model && <span className="model-used">{model}</span>}</div></div>
              {notice && <div className="chat-status" role="status">{notice}</div>}
              <div className="message-feed" aria-live="polite">
                {!messages.length && <div className="welcome-state"><div className="welcome-orb"><span>✳</span></div><h2>What’s on your mind?</h2><p>Ask anything. Start building. Figure it out together.</p><div className="starter-grid">{starters.map((item) => <button key={item.title} onClick={() => sendMessage(undefined, item.prompt)}><span>{item.icon}</span><b>{item.title}</b><i>↗</i></button>)}</div></div>}
                {messages.map((message, index) => <article className={`message-row ${message.role}`} key={index}><div className="message-avatar">{message.role === "user" ? "Y" : "L"}</div><div className="message-body"><div className="message-meta">{message.role === "user" ? "YOU" : "LAZIX"}<span>{message.role === "assistant" ? "✳" : ""}</span></div>{message.role === "user" ? <p>{message.content}</p> : <div className="message-content"><MessageContent content={message.content} /></div>}</div></article>)}
                {busy && <div className="thinking-row"><span className="thinking-orb">✳</span><div><b>LAZIX is working</b><small>Thinking through your request...</small></div><div className="thinking-dots"><i /><i /><i /></div></div>}
                <div ref={endRef} />
              </div>
              <form className="message-composer" onSubmit={(e) => sendMessage(e)}>
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="Message LAZIX..." rows={1} disabled={busy} aria-label="Message LAZIX" />
                <div className="composer-tools"><span>↵ Enter to send · Shift + Enter for new line</span>{busy ? <button type="button" onClick={stopGeneration} aria-label="Stop generating">■</button> : <button type="submit" disabled={!input.trim()} aria-label="Send message">↑</button>}</div>
              </form>
            </div>
            <div className="chat-footnote"><span>✳</span> LAZIX CAN MAKE MISTAKES. CHECK IMPORTANT INFORMATION.</div>
          </div>
        )}
      </section>
    </main>
  );
}
