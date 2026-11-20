"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "lazix-chat-v1";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ready]);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The request failed.");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setMessages([...next, { role: "assistant", content: message }]);
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    if (busy) return;
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="LAZIX home"><span className="brand-mark">L</span><span>LAZIX</span></a>
        <span className="status"><i /> TEXT MODE</span>
      </header>

      <section className="workspace">
        <div className="intro">
          <div className="eyebrow">YOUR PERSONAL AI WORKSPACE</div>
          <h1>Think less.<br /><span>Achieve more.</span></h1>
          <p>A clear mind for your biggest ideas.</p>
        </div>

        <section className="chat-card" aria-label="Chat">
          <div className="chat-heading">
            <div><strong>Conversation</strong><small>Your space to think out loud.</small></div>
            <button className="clear-button" onClick={clearChat} disabled={busy || messages.length === 0}>Clear</button>
          </div>

          <div className="messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="spark">✳</div>
                <strong>What shall we work on?</strong>
                <span>Ask a question, explore an idea, or plan your next move.</span>
              </div>
            )}
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={index}>
                <span className="message-label">{message.role === "user" ? "YOU" : "LAZIX"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {busy && <div className="typing"><i /><i /><i /> LAZIX is thinking</div>}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Message LAZIX..."
              rows={1}
              aria-label="Message LAZIX"
              disabled={busy}
            />
            <button className="send-button" type="submit" disabled={busy || !input.trim()} aria-label="Send message">↑</button>
          </form>
          <div className="composer-note">ENTER TO SEND · SHIFT + ENTER FOR NEW LINE</div>
        </section>
        <footer>LAZIX IS A WORK IN PROGRESS · BUILT TO GROW WITH YOU</footer>
      </section>
    </main>
  );
}