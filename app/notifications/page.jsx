"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NotificationsPage() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [error, setError] = useState(null);

  // ================= LOAD APPROVED POSTS ONLY =================
  const loadPosts = async (userId) => {
    try {
      setError(null);
      const { data: approvedPosts, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading approved posts:", error);
        setError("Failed to load posts. Please try again.");
        setPosts([]);
        setApprovedCount(0);
        return;
      }

      const formattedPosts = (approvedPosts || []).map(post => ({
        ...post,
        status: "approved",
      }));

      setPosts(formattedPosts);
      setApprovedCount(formattedPosts.length);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("loadPosts error:", err);
      setError("An unexpected error occurred while loading posts.");
      setPosts([]);
      setApprovedCount(0);
    }
  };

  // ================= LOAD ADMIN NOTIFICATIONS =================
  const loadNotifications = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Notification load error:", error);
        setError("Failed to load notifications. Please try again.");
        setNotifications([]);
        return;
      }

      setNotifications(data || []);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("loadNotifications error:", err);
      setError("An unexpected error occurred while loading notifications.");
      setNotifications([]);
    }
  };

  // ================= AUTH =================
  useEffect(() => {
    let ignore = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;

      if (!ignore) {
        setUser(u);
        if (u) {
          loadPosts(u.id);
          loadNotifications(u.id);
        }
        setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  // ================= REALTIME =================
  useEffect(() => {
    if (!user?.id) return;

    const postsSub = supabase
      .channel("posts_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Posts real-time update:", payload);
          loadPosts(user.id);
        }
      )
      .subscribe();

    const notifSub = supabase
      .channel("notifications_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Notifications real-time update:", payload);
          loadNotifications(user.id);
        }
      )
      .subscribe();

    return () => {
      postsSub.unsubscribe();
      notifSub.unsubscribe();
    };
  }, [user?.id]);

  // ================= ACTIONS =================
  const refreshData = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await Promise.all([
        loadPosts(user.id),
        loadNotifications(user.id),
      ]);
    } catch (err) {
      console.error("Refresh error:", err);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) {
        console.error("Error marking notification as read:", error);
        setError("Failed to mark notification as read. Please try again.");
        return;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== id));

      // Broadcast to other tabs/components that notifications changed
      try {
        if (typeof window !== "undefined" && user?.id) {
          localStorage.setItem(
            "shotzi_notification_update",
            JSON.stringify({ userId: user.id, ts: Date.now() })
          );
        }
      } catch (err) {
        // ignore storage errors
      }
      // dispatch custom event for same-tab immediate update
      try {
        if (typeof window !== 'undefined' && user?.id) {
          window.dispatchEvent(new CustomEvent('shotzi_notification_update_local', { detail: { userId: user.id, ts: Date.now() } }));
        }
      } catch (err) {
        // ignore
      }
    } catch (err) {
      console.error("markAsRead error:", err);
      setError("An unexpected error occurred.");
    }
  };

  // ================= UI =================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-shotzi-ink">
        <p className="text-shotzi-cream">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-shotzi-ink">
        <p className="text-shotzi-cream">Please login</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-shotzi-ink to-shotzi-ink/90">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-shotzi-cream">Notifications</h1>
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg bg-shotzi-wine/30 text-shotzi-cream hover:bg-shotzi-wine/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {refreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-shotzi-cream/30 border-t-shotzi-cream rounded-full animate-spin"></div>
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-xs text-red-300 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
            <p className="text-2xl font-bold text-shotzi-cream">{approvedCount}</p>
            <p className="text-shotzi-silver">Approved Posts</p>
          </div>

          <div className="bg-shotzi-wine/10 border border-shotzi-wine/20 rounded-xl p-6">
            <p className="text-2xl font-bold text-shotzi-cream">{notifications.length}</p>
            <p className="text-shotzi-silver">Admin Messages</p>
          </div>
        </div>

        {/* Approved Posts */}
        <h2 className="text-2xl font-semibold text-shotzi-cream mb-6">
          Accepted Posts
        </h2>

        {posts.length === 0 ? (
          <p className="text-shotzi-silver mb-12">No approved posts yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {posts.map((post) => (
              <div key={post.id} className="border rounded-xl overflow-hidden bg-shotzi-ink/50">
                <img
                  src={post.image_url}
                  alt={post.caption || "Approved post"}
                  className="h-48 w-full object-cover"
                  onError={(e) => {
                    e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDMTMuMSAyIDE0IDIuOSAxNCA0VjE2QzE0IDE3LjEgMTMuMSAxOCA5LjkgMTlIMTQuMUMxNS4xIDE5IDE2IDE4LjEgMTYgMTdWNFoiIGZpbGw9IiM5Q0E0QUYiLz4KPHBhdGggZD0iTTEwIDJDOS45IDIgOSA0IDkgMTJIMTFWMTRDMTMgMTQgMTQgMTIgMTQgNFoiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+";
                    e.target.alt = "Image failed to load";
                  }}
                  loading="lazy"
                />
                <div className="p-4">
                  <p className="text-shotzi-cream font-medium mb-2 line-clamp-2">
                    {post.caption || "No caption"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                      ✓ Approved
                    </span>
                    <span className="text-xs text-shotzi-silver">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Messages */}
        <h2 className="text-2xl font-semibold text-shotzi-cream mb-6">
          Messages
        </h2>

        {notifications.length === 0 ? (
          <p className="text-shotzi-silver">No new messages.</p>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => (
              <div key={n.id} className="border rounded-xl p-6 bg-shotzi-ink/50">
                <p className="text-shotzi-cream mb-3">{n.message}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-shotzi-silver">
                    {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="text-sm text-shotzi-wine hover:text-shotzi-wine/80 transition-colors px-3 py-1 rounded-lg hover:bg-shotzi-wine/10"
                    aria-label="Mark notification as read"
                  >
                    Mark as read
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
