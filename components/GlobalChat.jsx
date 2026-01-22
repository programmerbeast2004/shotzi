"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function GlobalChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState({});
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

  // Load initial messages
  useEffect(() => {
    if (!user) return;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("global_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(200);

        if (error) throw error;

        // keep only last 200 messages
        const list = data || [];
        setMessages(list.slice(-200));

        // Load profiles for all messages
        const userIds = [...new Set(list.map((m) => m.user_id))];
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, last_active")
            .in("id", userIds);

          const profileMap = {};
          (profilesData || []).forEach((p) => {
            profileMap[p.id] = p;
          });
          setProfiles(profileMap);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading messages:", error);
        setLoading(false);
      }
    };

    loadMessages();

    // Subscribe to new messages (dedupe by id)
    const channel = supabase
      .channel("global_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_messages" },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            const next = [...prev, payload.new];
            return next.slice(-200);
          });

          // Load profile if not already loaded
          setProfiles((prevProfiles) => {
            if (prevProfiles[payload.new.user_id]) return prevProfiles;
            // fetch and add
            supabase
              .from("profiles")
              .select("id, username, avatar_url, last_active")
              .eq("id", payload.new.user_id)
              .then(({ data }) => {
                if (data && data[0]) {
                  setProfiles((p) => ({ ...p, [data[0].id]: data[0] }));
                }
              });
            return prevProfiles;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    // use immediate scroll for snappier UX
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      } catch (err) {
        // fallback
        messagesEndRef.current.scrollIntoView();
      }
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user || sending) return;
    const text = input.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const optimisticMsg = {
      id: tempId,
      user_id: user.id,
      message: text,
      created_at: new Date().toISOString(),
      __optimistic: true,
    };

    // Add immediately for snappy UI
    setMessages((prev) => [...prev, optimisticMsg].slice(-200));
    setInput("");
    // ensure scroll happens right away
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "auto" });

    setSending(true);
    try {
      const { data, error } = await supabase
        .from("global_messages")
        .insert([
          {
            user_id: user.id,
            message: text,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with server row
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } catch (error) {
      console.error("Error sending message:", error);
      // mark failed message
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, __failed: true } : m)));
    } finally {
      setSending(false);
    }
  };

  const insertEmoji = (emoji) => {
    // insert emoji at cursor position
    const el = inputRef.current;
    if (!el) {
      setInput((v) => v + emoji);
      setShowEmoji(false);
      return;
    }

    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const newText = input.slice(0, start) + emoji + input.slice(end);
    setInput(newText);
    setShowEmoji(false);

    // restore cursor after update
    requestAnimationFrame(() => {
      try {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      } catch (err) {}
    });
  };

  const deleteMessage = async (messageId) => {
    try {
      const { error } = await supabase
        .from("global_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message");
    }
  };

  const retryMessage = async (tempId, messageText) => {
    try {
      const { data, error } = await supabase
        .from("global_messages")
        .insert([
          {
            user_id: user.id,
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

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-shotzi-silver">Please log in to chat</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-shotzi-ink">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-shotzi-sand/40 bg-shotzi-ink/95 backdrop-blur-xl p-4">
        <h1 className="text-xl sm:text-2xl font-serif text-shotzi-cream">
          🌍 Global Chat
        </h1>
        <p className="text-xs sm:text-sm text-shotzi-silver/80">
          Chat with everyone around the world
        </p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-shotzi-silver">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-shotzi-silver text-center">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const profile = profiles[msg.user_id];
            const isOwn = msg.user_id === user.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                          <Link href={`/u/${profile?.username || profile?.id}`} className="block">
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={profile.username}
                                className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 shadow-sm"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-shotzi-sand/40 flex items-center justify-center text-xs text-shotzi-cream ring-1 ring-white/10 shadow-sm">
                                {profile?.username?.[0]?.toUpperCase() || "?"}
                              </div>
                            )}
                          </Link>
                </div>

                {/* Message Content */}
                <div className={`flex flex-col ${isOwn ? "items-end" : ""}`}>
                  <div className="flex items-center gap-2">
                    <Link href={`/u/${profile?.username || profile?.id}`} className="text-xs text-shotzi-cream hover:underline font-medium">
                      {profile?.username || "Anonymous"}
                    </Link>
                    {/* online indicator */}
                    <span className={`w-2 h-2 rounded-full ${
                        profile?.last_active && (Date.now() - new Date(profile.last_active).getTime() < 60_000)
                          ? 'bg-emerald-400'
                          : 'bg-gray-500/40'
                      } border border-white/10`} title={profile?.last_active ? `Last active: ${new Date(profile.last_active).toLocaleString()}` : ''}></span>
                  </div>
                  <div
                    className={`px-4 py-2 rounded-lg max-w-xs break-words shadow-sm border border-white/3 ${
                      isOwn
                        ? "bg-shotzi-wine text-white rounded-br-none shadow-lg"
                        : "bg-shotzi-sand/20 text-shotzi-cream rounded-bl-none"
                    } transition-transform transform-gpu`}
                    style={{ wordBreak: 'break-word' }}
                  >
                    <p className="text-sm leading-snug">{msg.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {msg.__optimistic && <span className="text-xs text-yellow-300">⏳ sending</span>}
                      {msg.__failed && (
                        <button onClick={() => retryMessage(msg.id, msg.message)} className="text-xs text-shotzi-wine underline">Retry</button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-shotzi-silver/60">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {isOwn && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="text-xs text-shotzi-wine hover:text-shotzi-wine/80 transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 border-t border-shotzi-sand/40 bg-shotzi-ink/95 backdrop-blur-xl p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <form onSubmit={sendMessage} className="flex gap-2 items-center relative">
          {/* Emoji column */}
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
                    onClick={() => insertEmoji(em)}
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
