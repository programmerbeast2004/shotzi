"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminNotifier() {
  const [user, setUser] = useState(null);
  const [queue, setQueue] = useState([]); // pending posts to review

  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!ignore) setUser(data?.user ?? null);
    }
    loadUser();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!user || user.email !== "prvmehrotra@gmail.com") return;

    const ch = supabase
      .channel("admin_pending_posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_posts" },
        (payload) => {
          try {
            const evt = payload.eventType || payload.event;
            const newRow = payload.new || payload.record || null;
            const oldRow = payload.old || null;

            if (evt === "INSERT") {
              if (newRow?.status === "pending") {
                setQueue((q) => [newRow, ...q]);
              }
            } else if (evt === "UPDATE") {
              // if updated away from pending, remove from queue
              if (oldRow?.status === "pending" && newRow?.status !== "pending") {
                setQueue((q) => q.filter((p) => p.id !== newRow.id));
              }
              // if updated to pending, add
              if (newRow?.status === "pending") {
                setQueue((q) => [newRow, ...q.filter((p) => p.id !== newRow.id)]);
              }
            } else if (evt === "DELETE") {
              const rec = payload.old || null;
              if (rec) setQueue((q) => q.filter((p) => p.id !== rec.id));
            }
          } catch (err) {
            console.error("AdminNotifier payload error:", err);
          }
        }
      )
      .subscribe();

    // initial load of any pending posts
    (async () => {
      const { data } = await supabase.from("pending_posts").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(10);
      setQueue(data || []);
    })();

    return () => {
      ch.unsubscribe();
    };
  }, [user]);

  const approve = async (post) => {
    try {
      const { error: insertErr } = await supabase.from("posts").insert({
        image_url: post.image_url,
        caption: post.caption,
        user_id: post.user_id,
        user_email: post.user_email,
      });
      if (insertErr) throw insertErr;

      await supabase.from("pending_posts").update({ status: "approved" }).eq("id", post.id);

      await supabase.from("notifications").insert({
        user_id: post.user_id,
        message: "Your post has been approved and published!",
        read: false,
      });

      // Broadcast to the user's other tabs so their bell updates immediately
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('shotzi_notification_update', JSON.stringify({ userId: post.user_id, ts: Date.now() }));
        }
      } catch (err) {
        // ignore
      }

      // remove from queue
      setQueue((q) => q.filter((p) => p.id !== post.id));
    } catch (err) {
      console.error("Admin approve error:", err);
      alert("Failed to approve post.");
    }
  };

  const reject = async (post) => {
    try {
      await supabase.from("pending_posts").update({ status: "rejected" }).eq("id", post.id);

      await supabase.from("notifications").insert({
        user_id: post.user_id,
        message: "Your post was rejected.",
        read: false,
      });

      // Broadcast to the user's other tabs so their bell updates immediately
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('shotzi_notification_update', JSON.stringify({ userId: post.user_id, ts: Date.now() }));
        }
      } catch (err) {
        // ignore
      }

      setQueue((q) => q.filter((p) => p.id !== post.id));
    } catch (err) {
      console.error("Admin reject error:", err);
      alert("Failed to reject post.");
    }
  };

  if (!user || user.email !== "prvmehrotra@gmail.com") return null;

  return (
    <div aria-live="polite" className="fixed top-4 right-4 z-50 space-y-3">
      {queue.slice(0, 5).map((p) => (
        <div key={p.id} className="w-80 bg-shotzi-ink/95 border border-shotzi-sand/20 rounded-xl p-3 shadow-lg">
          <div className="flex gap-3">
            <img src={p.image_url} alt="pending" className="w-20 h-20 object-cover rounded-md" />
            <div className="flex-1">
              <p className="text-sm text-shotzi-cream font-medium line-clamp-2">{p.caption || "(no caption)"}</p>
              <p className="text-xs text-shotzi-silver mt-2">From: {p.user_email}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => approve(p)} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Approve</button>
                <button onClick={() => reject(p)} className="px-3 py-1 rounded bg-red-600 text-white text-sm">Reject</button>
                <button onClick={() => setQueue((q) => q.filter((x) => x.id !== p.id))} className="ml-auto px-2 py-1 rounded bg-shotzi-sand/10 text-xs">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
