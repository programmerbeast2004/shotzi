"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const PAGE_SIZE = 6;

export default function ReelsPage() {
  const [reels, setReels] = useState([]);
  const [user, setUser] = useState(null);
  const [likedIds, setLikedIds] = useState([]);
  const [activeComments, setActiveComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef(null);

  /* Load current user once */
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data?.user ?? null);
    });
    return () => (mounted = false);
  }, []);

  /* Load likes whenever user changes */
  useEffect(() => {
    if (!user) {
      setLikedIds([]);
      return;
    }
    let mounted = true;
    supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (mounted) {
          setLikedIds((data || []).map((r) => r.post_id));
        }
      });
    return () => (mounted = false);
  }, [user]);

  /* Fetch a page of reels */
  const loadReelsPage = useCallback(async (pg = 0) => {
    if (loading) return;
    setLoading(true);

    const from = pg * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: postRows, error } = await supabase
      .from("posts")
      .select("id, image_url, caption, created_at, user_id, user_email")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Failed to load reels:", error);
      setLoading(false);
      return;
    }

    if (!postRows || postRows.length === 0) {
      setHasMore(false);
      setLoading(false);
      return;
    }

    const userIds = postRows.map((p) => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);

    const merged = postRows.map((post) => {
      const prof = profiles?.find((p) => p.id === post.user_id);
      return {
        ...post,
        profile: prof || {
          username: post.user_email?.split("@")[0] || post.user_id.slice(0, 6),
          avatar_url: null,
        },
      };
    });

    // If first page, replace. Otherwise append.
    setReels((prev) => (pg === 0 ? merged : [...prev, ...merged]));

    // If fewer than requested rows, no more pages.
    if (postRows.length < PAGE_SIZE) setHasMore(false);

    setLoading(false);
  }, [loading]);

  useEffect(() => {
    loadReelsPage(0);
  }, [loadReelsPage]);

  /* Infinite scroll observer */
  useEffect(() => {
    if (!hasMore) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) {
        const next = page + 1;
        setPage(next);
        loadReelsPage(next);
      }
    }, { root: null, rootMargin: "200px" });

    if (observerRef.current) obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [page, hasMore, loading, loadReelsPage]);

  /* Toggle like */
  const toggleLike = async (postId) => {
    if (!user) return alert("Login to like.");
    if (likedIds.includes(postId)) {
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
      setLikedIds((p) => p.filter((id) => id !== postId));
    } else {
      await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
      setLikedIds((p) => [...p, postId]);
    }
  };

  /* Comments */
  const loadComments = async (postId) => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, user_id, user_email, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    setComments((prev) => ({
      ...prev,
      [postId]: (data || []).map((c) => ({
        ...c,
        username: c.user_email?.split("@")[0] || c.user_id.slice(0, 6),
      })),
    }));
  };

  const handleCommentSubmit = async (postId) => {
    if (!user) return alert("Login to comment.");
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText("");

    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: user.id, user_email: user.email, content: text })
      .select()
      .single();

    if (!error) {
      setComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), { ...data, username: data.user_email?.split("@")[0] }],
      }));
    }
  };

  /* Delete comment (only owner or post owner) */
  const deleteComment = async (commentId, postId) => {
    if (!user) return;
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);
    if (error) return alert("Failed to delete comment.");
    setComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));
  };

  /* Delete post (only post owner) */
  const deletePost = async (postId) => {
    if (!user) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
    if (error) return alert("Failed to delete post.");
    setReels((prev) => prev.filter((r) => r.id !== postId));
  };

  /* Delete profile (current user) */
  const deleteProfile = async () => {
    if (!user) return;
    if (!confirm("Delete your profile? This will remove your profile record and sign you out.")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) return alert("Failed to delete profile.");
    await supabase.auth.signOut();
    setUser(null);
    alert("Profile deleted. Auth account still exists; contact support to remove the auth account if desired.");
  };

  /* Share / download helpers */
  const sharePost = async (postId) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/post/${postId}`;
    try {
      await navigator.share?.({ title: 'Check this post', url });
    } catch (e) {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black">
      {/* Top-left: Delete Profile Button */}
      <div className="absolute top-4 left-4 z-50 text-white">
        {user ? (
          <button onClick={() => deleteProfile()} className="bg-red-600/80 px-3 py-1 rounded text-sm hover:bg-red-700 font-semibold">
            🗑️ Delete Profile
          </button>
        ) : (
          <div className="text-white/50 text-xs">Sign in to delete profile</div>
        )}
      </div>

      <div className="flex flex-col">
        {reels.map((reel) => (
          <div key={reel.id} className="relative h-screen w-full flex items-center justify-center border-b border-white/5">

            {/* Centered image, object-contain so not cropped */}
            <img src={reel.image_url} alt="" className="max-h-[100vh] max-w-full object-contain" />

            {/* Gradient overlay + caption */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

            <div className="absolute bottom-20 left-4 right-20 text-white space-y-2 pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full overflow-hidden border border-white/40">
                  {reel.profile.avatar_url ? (
                    <img src={reel.profile.avatar_url} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-shotzi-wine flex items-center justify-center font-bold">
                      {reel.profile.username[0].toUpperCase()}
                    </div>
                  )}
                </div>

                <Link href={`/u/${reel.profile.username}`} className="font-semibold">
                  @{reel.profile.username}
                </Link>
              </div>

              {reel.caption && <p className="text-sm opacity-90">{reel.caption}</p>}
            </div>

            {/* Right action bar */}
            <div className="absolute bottom-20 right-4 flex flex-col items-center gap-5 text-white text-2xl pointer-events-auto">
              <button onClick={() => toggleLike(reel.id)} className="text-2xl hover:scale-110 transition">
                {likedIds.includes(reel.id) ? "❤️" : "🤍"}
              </button>

              <button
                onClick={() => {
                  setActiveComments(reel.id);
                  loadComments(reel.id);
                }}
                className="text-2xl hover:scale-110 transition"
              >
                💬
              </button>

              <button onClick={() => sharePost(reel.id)} className="text-2xl hover:scale-110 transition">↗</button>

              <a href={reel.image_url} download className="text-xl hover:scale-110 transition">⬇️</a>

              {/* Delete post visible only to post owner */}
              {user && user.id === reel.user_id && (
                <button onClick={() => deletePost(reel.id)} className="text-red-400 text-xl hover:text-red-500 hover:scale-110 transition" title="Delete Post">
                  🗑️
                </button>
              )}
            </div>

            {/* Comments panel */}
            {activeComments === reel.id && (
              <div className="absolute inset-x-0 bottom-0 bg-black max-h-[60vh] flex flex-col border-t border-white/20 pointer-events-auto">
                <div className="flex justify-between p-4 border-b border-white/20">
                  <h3 className="text-white font-semibold">Comments</h3>
                  <button onClick={() => setActiveComments(null)} className="text-white">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(comments[reel.id] || []).map((c) => (
                    <div key={c.id} className="text-white text-sm flex justify-between items-start gap-2 bg-white/5 p-2 rounded">
                      <div className="flex-1">
                        <b>@{c.username}</b>: {c.content}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {user && user.id === c.user_id && (
                          <button onClick={() => deleteComment(c.id, reel.id)} className="text-red-400 text-xs hover:text-red-300 whitespace-nowrap" title="Delete Comment">
                            ✕
                          </button>
                        )}
                        {user && user.id === reel.user_id && c.user_id !== user.id && (
                          <button onClick={() => deleteComment(c.id, reel.id)} className="text-red-400 text-xs hover:text-red-300 whitespace-nowrap" title="Delete (Post Owner)">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {user && (
                  <div className="p-3 border-t border-white/20 flex gap-2">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 bg-black border border-white/30 px-3 py-2 rounded-full text-white text-sm"
                    />
                    <button onClick={() => handleCommentSubmit(reel.id)} className="bg-white text-black px-4 py-2 rounded-full text-sm">
                      Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* sentinel for intersection observer (infinite load) */}
        <div ref={observerRef} className="h-24 flex items-center justify-center text-white/60">
          {loading ? "Loading..." : hasMore ? "Scroll to load more" : "No more reels"}
        </div>
      </div>
    </div>
  );
}
