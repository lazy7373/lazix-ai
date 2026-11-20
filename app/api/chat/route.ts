import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(request: NextRequest) {
  const inferenceUrl = process.env.LAZIX_INFERENCE_URL?.trim().replace(/\/+$/, "");
  const model = process.env.LAZIX_MODEL?.trim() || "Qwen/Qwen3-4B-Instruct-2507";

  if (!inferenceUrl) {
    return NextResponse.json(
      { error: "LAZIX's private AI server is not connected yet. Configure LAZIX_INFERENCE_URL on the web app." },
      { status: 503 }
    );
  }

  let payload: { messages?: ChatMessage[] };
  try {
    payload = await request.json() as { messages?: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return NextResponse.json({ error: "Send at least one message to start chatting." }, { status: 400 });
  }

  const messages = payload.messages.filter((message) =>
    message &&
    ["user", "assistant", "system"].includes(message.role) &&
    typeof message.content === "string"
  );

  if (messages.length !== payload.messages.length || messages.some((message) => !message.content.trim())) {
    return NextResponse.json({ error: "The conversation contains an invalid message." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${inferenceUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LAZIX_INFERENCE_TOKEN
          ? { Authorization: `Bearer ${process.env.LAZIX_INFERENCE_TOKEN}` }
          : {})
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7
      }),
      cache: "no-store",
      signal: request.signal
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("Private inference server error:", upstream.status, detail.slice(0, 1000));
      return NextResponse.json(
        { error: `LAZIX's AI server returned an error (${upstream.status}). Check the model server logs and configuration.` },
        { status: 502 }
      );
    }

    if (!upstream.body) {
      return NextResponse.json({ error: "The AI server did not return a response stream." }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    console.error("Could not connect to private inference server:", error);
    return NextResponse.json(
      { error: "Could not connect to LAZIX's private AI server. It may be offline or unreachable." },
      { status: 502 }
    );
  }
}
