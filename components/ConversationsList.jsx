"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ConversationsList({ selectedUserId, onSelectUser }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
    };
    getUser();
  }, []);

  // Load conversations and unread counts
  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      try {
        setLoading(true);

        // Get all users the current user has messaged
        const { data: messages, error } = await supabase
          .from("direct_messages")
          .select("sender_id, recipient_id")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Extract unique conversation partners
        const partners = new Set();
        (messages || []).forEach((msg) => {
          const otherId =
            msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
          partners.add(otherId);
        });

        if (partners.size === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }

        // Fetch profiles of conversation partners
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", Array.from(partners));

        // Get unread counts and last message for each conversation
        const convs = await Promise.all(
          (profiles || []).map(async (profile) => {
            const { count } = await supabase
              .from("direct_messages")
              .select("id", { count: "exact" })
              .eq("recipient_id", user.id)
              .eq("sender_id", profile.id)
              .eq("read", false);

            const { data: lastMsgData } = await supabase
              .from("direct_messages")
              .select("message, created_at")
              .or(
                `and(sender_id.eq.${user.id},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${user.id})`
              )
              .order("created_at", { ascending: false })
              .limit(1);

            return {
              ...profile,
              unreadCount: count || 0,
              lastMessage: lastMsgData?.[0]?.message || "",
              lastMessageTime: lastMsgData?.[0]?.created_at || null,
            };
          })
        );

        // Sort by last message time
        convs.sort(
          (a, b) =>
            new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
        );

        setConversations(convs);
        setLoading(false);
      } catch (error) {
        console.error("Error loading conversations:", error);
        setLoading(false);
      }
    };

    loadConversations();

    // Subscribe to new messages to update the list
    const channel = supabase
      .channel("direct_messages_list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          if (
            payload.new.sender_id === user.id ||
            payload.new.recipient_id === user.id
          ) {
            loadConversations();
          }
        }
      )
      .subscribe();

    // Listen for local broadcasts when a conversation is marked read
    const storageHandler = (e) => {
      if (!e) return;
      if (e.key === 'shotzi_message_update') {
        try {
          const payload = JSON.parse(e.newValue || '{}');
          // if payload concerns this user, reload
          if (payload.userId === user.id || payload.partnerId === user.id) {
            loadConversations();
          }
        } catch (err) {}
      }
    };

    const localHandler = (e) => {
      try {
        const payload = e?.detail || {};
        if (payload.userId === user.id || payload.partnerId === user.id) {
          loadConversations();
        }
      } catch (err) {}
    };

    window.addEventListener('storage', storageHandler);
    window.addEventListener('shotzi_message_update_local', localHandler);

    return () => {
      channel.unsubscribe();
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('shotzi_message_update_local', localHandler);
    };
  }, [user]);

  const filteredConversations = conversations.filter((conv) =>
    conv.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r border-shotzi-sand/40">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-shotzi-sand/40 p-4 bg-shotzi-ink/95">
        <h2 className="text-lg font-serif text-shotzi-cream mb-3">
          💬 Messages
        </h2>
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-shotzi-sand/20 text-shotzi-cream placeholder-shotzi-silver/50 border border-shotzi-sand/40 focus:outline-none focus:border-shotzi-wine transition text-sm"
        />
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
          <div className="p-4 text-center text-shotzi-silver text-sm">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-shotzi-silver text-sm">
            {conversations.length === 0
              ? "No conversations yet"
              : "No matching conversations"}
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectUser(conv.id, conv.username)}
              className={`w-full px-4 py-3 border-b border-shotzi-sand/20 hover:bg-shotzi-sand/10 transition text-left flex items-start gap-3 ${
                selectedUserId === conv.id ? "bg-shotzi-sand/20" : ""
              }`}
            >
              {/* Avatar */}
              {conv.avatar_url ? (
                <img
                  src={conv.avatar_url}
                  alt={conv.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-shotzi-sand/40 flex items-center justify-center text-xs text-shotzi-cream flex-shrink-0">
                  {conv.username[0].toUpperCase()}
                </div>
              )}

              {/* Message Preview */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 justify-between mb-1">
                  <p
                    className={`text-sm font-medium truncate ${
                      conv.unreadCount > 0 ? "text-shotzi-cream" : "text-shotzi-silver"
                    }`}
                  >
                    {conv.username}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="text-xs bg-shotzi-wine text-white px-2 py-0.5 rounded-full flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-shotzi-silver/70 truncate">
                  {conv.lastMessage || "No messages yet"}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
