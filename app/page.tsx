"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Message = { role: "user" | "assistant"; content: string };
type Memory = { id: string; content: string; created_at: string };
const STORAGE_KEY = "lazix-chat-v1";
const supabase = getSupabaseBrowserClient();

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
  const [notice, setNotice] = useState("");
  const [memoryBusy, setMemoryBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch { localStorage.removeItem(STORAGE_KEY); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setNotice("");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.access_token) { setMemories([]); return; }
    let active = true;
    fetch("/api/memory", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load memory.");
        if (active) setMemories(data.memories || []);
      })
      .catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ready]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setNotice("");
    try {
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (authMode === "signup" && !result.data.session) {
        setNotice("Check your email to confirm your LAZIX account, then sign in.");
      } else {
        setNotice("You're signed in. Your LAZIX memory is ready.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setAuthBusy(false); }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMemories([]);
    setNotice("Signed out.");
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = memoryInput.trim();
    if (!content || !session || memoryBusy) return;
    setMemoryBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save memory.");
      setMemories((current) => [data.memory, ...current]);
      setMemoryInput("");
      setNotice("Saved to permanent memory.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save memory."); }
    finally { setMemoryBusy(false); }
  }

  async function deleteMemory(id: string) {
    if (!session) return;
    const response = await fetch(`/api/memory?id=${encodeURIComponent(id)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "Could not delete memory."); return; }
    setMemories((current) => current.filter((item) => item.id !== id));
    setNotice("Memory deleted.");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ messages: next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The request failed.");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setMessages([...next, { role: "assistant", content: message }]);
    } finally { setBusy(false); }
  }

  function clearChat() {
    if (busy) return;
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="LAZIX home"><span className="brand-mark">L</span><span>LAZIX</span></Link>
        <span className="status"><i /> TEXT MODE</span>
      </header>
      <section className="workspace">
        <div className="intro">
          <div className="eyebrow">YOUR PERSONAL AI WORKSPACE</div>
          <h1>Think less.<br /><span>Achieve more.</span></h1>
          <p>A clear mind for your biggest ideas.</p>
        </div>

        <section className="memory-card">
          <div className="memory-title"><div><strong>Permanent memory</strong><small>One memory shared across every AI model.</small></div>
            {session && <button className="clear-button" onClick={signOut}>Sign out</button>}
          </div>
          {!isSupabaseConfigured() ? (
            <p className="memory-hint">Connect your Supabase project to turn on permanent memory.</p>
          ) : !session ? (
            <form className="auth-form" onSubmit={handleAuth}>
              <p className="memory-hint">Create your private LAZIX account or sign in to access your saved memories.</p>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (at least 6 characters)" minLength={6} required />
              <button className="memory-save" type="submit" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "signin" ? "Sign in" : "Create account"}</button>
              <button className="mode-button" type="button" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
                {authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
            </form>
          ) : (
            <>
              <div className="signed-in">Signed in as <b>{session.user.email}</b></div>
              <form className="memory-form" onSubmit={saveMemory}>
                <input value={memoryInput} onChange={(event) => setMemoryInput(event.target.value)} placeholder="Add something LAZIX should remember..." maxLength={2000} />
                <button className="memory-save" type="submit" disabled={memoryBusy || !memoryInput.trim()}>{memoryBusy ? "Saving..." : "Save memory"}</button>
              </form>
              <div className="memory-list">
                {memories.length === 0 ? <p className="memory-hint">No saved memories yet. Add your first one above.</p> :
                  memories.map((memory) => <div className="memory-item" key={memory.id}><span>{memory.content}</span><button onClick={() => deleteMemory(memory.id)} aria-label="Delete memory">×</button></div>)}
              </div>
            </>
          )}
          {notice && <p className="notice" role="status">{notice}</p>}
        </section>

        <section className="chat-card" aria-label="Chat">
          <div className="chat-heading">
            <div><strong>Conversation</strong><small>Your space to think out loud.</small></div>
            <button className="clear-button" onClick={clearChat} disabled={busy || messages.length === 0}>Clear</button>
          </div>
          <div className="messages" aria-live="polite">
            {messages.length === 0 && <div className="empty-state"><div className="spark">✳</div><strong>What shall we work on?</strong><span>Ask a question, explore an idea, or plan your next move.</span></div>}
            {messages.map((message, index) => <article className={`message ${message.role}`} key={index}>
              <span className="message-label">{message.role === "user" ? "YOU" : "LAZIX"}</span><p>{message.content}</p>
            </article>)}
            {busy && <div className="typing"><i /><i /><i /> LAZIX is thinking</div>}
            <div ref={endRef} />
          </div>
          <form className="composer" onSubmit={sendMessage}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
              placeholder="Message LAZIX..." rows={1} aria-label="Message LAZIX" disabled={busy} />
            <button className="send-button" type="submit" disabled={busy || !input.trim()} aria-label="Send message">↑</button>
          </form>
          <div className="composer-note">ENTER TO SEND · SHIFT + ENTER FOR NEW LINE</div>
        </section>
        <footer>LAZIX IS A WORK IN PROGRESS · BUILT TO GROW WITH YOU</footer>
      </section>
    </main>
  );
}
