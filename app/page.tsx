"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "lazix-local-chat-v1";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed as Message[]);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, ready]);

  async function sendMessage(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const text = (suggested ?? input).trim();
    if (!text || busy) return;

    const next: Message[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(0, -1) }),
        signal: controller.signal
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "LAZIX could not reach its AI brain.");
      }
      if (!response.body) throw new Error("The AI server returned an empty response.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventBlock of events) {
          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const packet = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
              answer += packet.choices?.[0]?.delta?.content ?? "";
              setMessages((current) => {
                const updated = [...current];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: answer };
                return updated;
              });
            } catch {
              // Ignore non-JSON keepalive frames.
            }
          }
        }
      }
      if (!answer.trim()) {
        setMessages((current) => current.map((message, index) =>
          index === current.length - 1 && message.role === "assistant"
            ? { ...message, content: "I didn't receive a text response. Please try again." }
            : message
        ));
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Something went wrong.";
      if (message !== "The operation was aborted.") setError(message);
      if (message !== "The operation was aborted.") {
        setMessages((current) => current[current.length - 1]?.content
          ? current
          : current.slice(0, -1));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setError("");
    setBusy(false);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="LAZIX home"><span className="brand-mark">L</span><span>LAZIX</span></Link>
        <button className="new-chat" onClick={newChat}><span>＋</span> New chat</button>
        <div className="sidebar-caption">YOUR SPACE</div>
        <div className="sidebar-note"><span className="status-dot" /> Private chat session</div>
        <div className="sidebar-bottom">
          <div className="brain-card"><span className="brain-icon">✳</span><div><strong>Self-hosted AI</strong><small>Your own model server</small></div></div>
          <div className="sidebar-foot">BUILT INDEPENDENTLY<br />POWERED BY YOUR SERVER</div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-title"><span className="mobile-brand">LAZIX</span><span className="topbar-divider">/</span><span>New conversation</span></div>
          <div className="server-status"><span className="status-dot" /> OWN AI ENGINE</div>
        </header>

        <div className="chat-area" ref={feedRef}>
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-symbol">L<span>✳</span></div>
              <div className="eyebrow">YOUR AI. YOUR RULES.</div>
              <h1>Think freely.<br /><em>Build anything.</em></h1>
              <p>A fresh space to ask, explore, learn and create.<br />LAZIX connects to a language model running on your own server.</p>
              <div className="suggestions">
                {["Explain a difficult topic simply", "Help me build a new project", "Brainstorm something original", "Write or improve some code"].map((item) =>
                  <button key={item} onClick={() => void sendMessage(undefined, item)}>{item}<span>↗</span></button>
                )}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <article className={`message ${message.role}`} key={index}>
                  <div className="message-avatar">{message.role === "assistant" ? "L" : "Y"}</div>
                  <div className="message-content">
                    <div className="message-label">{message.role === "assistant" ? "LAZIX" : "YOU"}</div>
                    <div className="message-text">{message.content || (busy && index === messages.length - 1 ? <span className="typing"><i /><i /><i /></span> : "")}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <div className="error-banner">{error}</div>}
          <form className="composer" onSubmit={(event) => void sendMessage(event)}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
              placeholder="Message LAZIX..."
              rows={1}
              aria-label="Message LAZIX"
            />
            {busy
              ? <button className="send-button stop-button" type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop response">■</button>
              : <button className="send-button" type="submit" disabled={!input.trim()} aria-label="Send message">↑</button>}
          </form>
          <div className="composer-hint">LAZIX runs on your own model server · Shift + Enter for a new line</div>
        </div>
      </section>
    </main>
  );
}
