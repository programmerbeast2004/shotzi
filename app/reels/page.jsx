"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ReelsPage() {
  const [reels, setReels] = useState([]);
  const [user, setUser] = useState(null);
  const [likedIds, setLikedIds] = useState([]);
  const [activeComments, setActiveComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState({});
  const containerRef = useRef(null);

  /* ✅ LOAD REELS + USER + LIKES */
  useEffect(() => {
    let ignore = false;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const cu = userData?.user ?? null;
      if (!ignore) setUser(cu);

      const { data: postRows } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at, user_id, user_email")
        .order("created_at", { ascending: false });

      if (!postRows || postRows.length === 0) {
        setReels([]);
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
            username:
              post.user_email?.split("@")[0] || post.user_id.slice(0, 6),
            avatar_url: null,
          },
        };
      });

      let liked = [];
      if (cu) {
        const { data: likeRows } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", cu.id);
        liked = (likeRows || []).map((r) => r.post_id);
      }

      if (!ignore) {
        setReels(merged);
        setLikedIds(liked);
      }
    }

    load();
    return () => (ignore = true);
  }, []);

  /* ✅ LIKE TOGGLE */
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

  /* ✅ LOAD COMMENTS FOR A POST */
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

  /* ✅ COMMENT SUBMIT (REAL DB FIXED) */
  const handleCommentSubmit = async (postId) => {
    if (!user) return alert("Login to comment.");
    if (!commentText.trim()) return;

    const text = commentText;
    setCommentText("");

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        user_email: user.email,
        content: text,
      })
      .select()
      .single();

    if (!error) {
      setComments((prev) => ({
        ...prev,
        [postId]: [
          ...(prev[postId] || []),
          {
            ...data,
            username: data.user_email?.split("@")[0],
          },
        ],
      }));
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-y-scroll snap-y snap-mandatory bg-black">
      {reels.map((reel) => (
        <div key={reel.id} className="relative h-screen w-full snap-start overflow-hidden">

          {/* ✅ PERFECT FULLSCREEN IMAGE */}
          <img
            src={reel.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* ✅ DARK GRADIENT */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* ✅ PROFILE + CAPTION */}
          <div className="absolute bottom-20 left-4 right-20 text-white space-y-2">
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

          {/* ✅ RIGHT ACTION BAR */}
          <div className="absolute bottom-20 right-4 flex flex-col items-center gap-5 text-white text-3xl">
            <button onClick={() => toggleLike(reel.id)}>
              {likedIds.includes(reel.id) ? "❤️" : "🤍"}
            </button>

            <button
              onClick={() => {
                setActiveComments(reel.id);
                loadComments(reel.id);
              }}
            >
              💬
            </button>

            <button>↗</button>
          </div>

          {/* ✅ COMMENTS PANEL */}
          {activeComments === reel.id && (
            <div className="absolute inset-x-0 bottom-0 bg-black max-h-[60vh] flex flex-col border-t border-white/20">
              <div className="flex justify-between p-4 border-b border-white/20">
                <h3 className="text-white font-semibold">Comments</h3>
                <button onClick={() => setActiveComments(null)} className="text-white">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(comments[reel.id] || []).map((c) => (
                  <div key={c.id} className="text-white text-sm">
                    <b>@{c.username}</b>: {c.content}
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
                  <button
                    onClick={() => handleCommentSubmit(reel.id)}
                    className="bg-white text-black px-4 py-2 rounded-full text-sm"
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {reels.length === 0 && (
        <div className="h-screen flex items-center justify-center text-gray-400">
          No reels yet.
        </div>
      )}
    </div>
  );
}
