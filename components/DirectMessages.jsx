"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function DirectMessages({ selectedUserId, selectedUsername }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const EMOJIS = ["😀", "😂", "😍", "🔥", "👍", "🎉", "😢", "😮", "🙏", "✨"];

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
    };
    getUser();
  }, []);

  // Load messages for this conversation
  useEffect(() => {
    if (!user || !selectedUserId) return;

    const broadcastRead = (partnerId) => {
      try {
        const payload = { userId: user.id, partnerId, ts: Date.now() };
        window.localStorage.setItem('shotzi_message_update', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('shotzi_message_update_local', { detail: payload }));
      } catch (err) {
        // ignore
      }
    };

    const loadMessages = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},recipient_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true });

        if (error) throw error;
        setMessages(data || []);

        // Mark messages as read
        if (data && data.length > 0) {
          const unreadIds = data
            .filter((m) => m.recipient_id === user.id && !m.read)
            .map((m) => m.id);

          if (unreadIds.length > 0) {
            await supabase
              .from("direct_messages")
              .update({ read: true })
              .in("id", unreadIds);

            // notify local listeners to update unread counters
            broadcastRead(selectedUserId);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading messages:", error);
        setLoading(false);
      }
    };

    loadMessages();

    // Subscribe to new messages (use stable lexicographic channel name and dedupe)
    const [a, b] = [user.id, selectedUserId].sort();
    const channelName = `direct_${a}_${b}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `or(and(sender_id.eq.${user.id},recipient_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},recipient_id.eq.${user.id}))`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            const next = [...prev, payload.new];
            return next.slice(-200);
          });

          // Mark as read if it's for us
          if (payload.new.recipient_id === user.id && !payload.new.read) {
            supabase
              .from("direct_messages")
              .update({ read: true })
              .eq("id", payload.new.id)
              .then(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === payload.new.id ? { ...m, read: true } : m
                  )
                );
                // notify local listeners that this conversation has been read
                broadcastRead(selectedUserId);
              });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, selectedUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      } catch (err) {
        messagesEndRef.current.scrollIntoView();
      }
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user || !selectedUserId || sending) return;
    const text = input.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const optimisticMsg = {
      id: tempId,
      sender_id: user.id,
      recipient_id: selectedUserId,
      message: text,
      created_at: new Date().toISOString(),
      __optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg].slice(-200));
    setInput("");
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "auto" });

    setSending(true);
    try {
      const { data, error } = await supabase
        .from("direct_messages")
        .insert([
          {
            sender_id: user.id,
            recipient_id: selectedUserId,
            message: text,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, __failed: true } : m)));
    } finally {
      setSending(false);
    }
  };

  const retryMessage = async (tempId, messageText) => {
    try {
      const { data, error } = await supabase
        .from("direct_messages")
        .insert([
          {
            sender_id: user.id,
            recipient_id: selectedUserId,
            message: messageText,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } catch (err) {
      console.error("Retry failed:", err);
      alert("Retry failed");
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const { error } = await supabase
        .from("direct_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message");
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-shotzi-silver">Please log in</p>
      </div>
    );
  }

  if (!selectedUserId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-shotzi-silver">Select a user to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-shotzi-sand/40 bg-shotzi-ink/95 p-4 flex items-center justify-between">
        <h2 className="text-lg font-serif text-shotzi-cream">
          💬 <Link href={`/u/${selectedUsername}`} className="hover:underline">{selectedUsername}</Link>
        </h2>
        <div className="text-xs text-shotzi-silver">Secure • Text-only</div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-shotzi-silver">Loading...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-shotzi-silver text-center">
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user.id;

            return (
              <div key={msg.id} className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                <div
                  className={`px-4 py-2 rounded-lg max-w-xs break-words shadow-sm border border-white/3 ${
                    isOwn
                      ? "bg-shotzi-wine text-white rounded-br-none shadow-lg"
                      : "bg-shotzi-sand/20 text-shotzi-cream rounded-bl-none"
                  } transition-transform transform-gpu`}
                >
                  <p className="text-sm leading-snug">{msg.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {msg.__optimistic && <span className="text-xs text-yellow-300">⏳ sending</span>}
                    {msg.__failed && (
                      <button onClick={() => retryMessage(msg.id, msg.message)} className="text-xs text-shotzi-wine underline">Retry</button>
                    )}
                  </div>
                </div>
                {isOwn && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="text-xs text-shotzi-wine hover:text-shotzi-wine/80 transition"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-shotzi-sand/40 bg-shotzi-ink/95 p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <form onSubmit={sendMessage} className="flex gap-2 items-center relative">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmoji((s) => !s)}
              className="w-9 h-9 rounded-md bg-shotzi-sand/10 flex items-center justify-center text-lg hover:scale-105 transition"
              title="Insert emoji"
            >
              😊
            </button>

            {showEmoji && (
              <div className="absolute left-4 bg-shotzi-ink border border-shotzi-sand/20 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-2"
                style={{ bottom: '4.5rem', maxWidth: '90vw' }}>
                {EMOJIS.map((em) => (
                  <button
                    type="button"
                    key={em}
                    onClick={() => {
                      const el = inputRef.current;
                      if (!el) {
                        setInput((v) => v + em);
                        setShowEmoji(false);
                        return;
                      }
                      const start = el.selectionStart ?? input.length;
                      const end = el.selectionEnd ?? input.length;
                      const newText = input.slice(0, start) + em + input.slice(end);
                      setInput(newText);
                      setShowEmoji(false);
                      requestAnimationFrame(() => {
                        try {
                          el.focus();
                          const pos = start + em.length;
                          el.setSelectionRange(pos, pos);
                        } catch (err) {}
                      });
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-shotzi-sand/10 transition text-xl"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-lg bg-shotzi-sand/20 text-shotzi-cream placeholder-shotzi-silver/50 border border-shotzi-sand/40 focus:outline-none focus:border-shotzi-wine transition"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-6 py-2 rounded-lg bg-shotzi-wine text-white font-medium hover:bg-shotzi-wine/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
