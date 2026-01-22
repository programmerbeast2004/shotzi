"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!ignore) {
        setUser(u);
        if (u && u.email === 'prvmehrotra@gmail.com') {
          // Load pending posts
          const { data: posts } = await supabase
            .from("pending_posts")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false });
          setPendingPosts(posts || []);
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  // Realtime: reload pending posts when table changes
  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!u || u.email !== 'prvmehrotra@gmail.com') return;

      subscription = supabase
        .channel('pending_posts_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_posts' }, (payload) => {
          (async () => {
            const { data: posts } = await supabase.from('pending_posts').select('*').eq('status', 'pending').order('created_at', { ascending: false });
            setPendingPosts(posts || []);
          })();
        })
        .subscribe();
    })();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const approvePost = async (post) => {
    // Move to posts
    const { error: insertErr } = await supabase.from("posts").insert({
      image_url: post.image_url,
      caption: post.caption,
      user_id: post.user_id,
      user_email: post.user_email,
    });
    if (insertErr) {
      alert("Failed to approve post.");
      return;
    }
    // Update pending to approved
    await supabase.from("pending_posts").update({ status: "approved" }).eq("id", post.id);
    // Notify user
    await supabase.from("notifications").insert({
      user_id: post.user_id,
      message: "Your post has been approved and published!",
      read: false,
    });
    // Remove from list
    setPendingPosts((prev) => prev.filter((p) => p.id !== post.id));
  };

  const rejectPost = async (post) => {
    // Update to rejected
    await supabase.from("pending_posts").update({ status: "rejected" }).eq("id", post.id);
    // Notify user
    await supabase.from("notifications").insert({
      user_id: post.user_id,
      message: "Your post was rejected.",
      read: false,
    });
    // Remove from list
    setPendingPosts((prev) => prev.filter((p) => p.id !== post.id));
  };

  if (loading) {
    return <div className="pt-8 text-center">Loading...</div>;
  }

  if (!user || user.email !== 'prvmehrotra@gmail.com') {
    return (
      <div className="pt-8 text-center">
        <div className="card p-6">
          <h1 className="text-lg text-shotzi-cream">Access Denied</h1>
          <p className="text-sm text-shotzi-silver">This page is for administrators only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 px-4">
      <h1 className="text-xl text-shotzi-cream mb-4">Admin Panel - Pending Posts</h1>
      {pendingPosts.length === 0 ? (
        <p className="text-shotzi-silver">No pending posts.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingPosts.map((post) => (
            <div key={post.id} className="card p-4">
              <img src={post.image_url} alt="Pending post" className="w-full h-48 object-cover mb-2" />
              <p className="text-sm text-shotzi-cream">{post.caption}</p>
              <p className="text-xs text-shotzi-silver">By: {post.user_email}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => approvePost(post)}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectPost(post)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}