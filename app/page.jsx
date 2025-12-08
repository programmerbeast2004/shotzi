"use client";

import { useEffect, useState } from "react";
import PostGrid from "../components/PostGrid";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState([]);
  const [likeCountMap, setLikeCountMap] = useState({});
  const [commentCountMap, setCommentCountMap] = useState({});

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);

      const [{ data: userData }, { data: postsData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("posts")
          .select("*") // ✅ FIXED: no JOIN (RLS safe)
          .order("created_at", { ascending: false }),
      ]);

      if (ignore) return;

      const u = userData?.user ?? null;
      setUser(u);

      const posts = (postsData || []).map((p) => ({
        ...p,
        profile_username:
          p?.user_email?.split("@")[0] || "user",
      }));

      setPosts(posts);

      const postIds = posts.map((p) => p.id);
      if (!postIds.length) {
        setLikeCountMap({});
        setCommentCountMap({});
        setLikedPostIds([]);
        setLoading(false);
        return;
      }

      const likePromise = supabase
        .from("likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      const commentPromise = supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);

      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        likePromise,
        commentPromise,
      ]);

      const likeCounts = {};
      const likedByUser = [];

      (likeRows || []).forEach((row) => {
        likeCounts[row.post_id] = (likeCounts[row.post_id] || 0) + 1;
        if (u && row.user_id === u.id) likedByUser.push(row.post_id);
      });

      const commentCounts = {};
      (commentRows || []).forEach((row) => {
        commentCounts[row.post_id] = (commentCounts[row.post_id] || 0) + 1;
      });

      if (!ignore) {
        setLikeCountMap(likeCounts);
        setCommentCountMap(commentCounts);
        setLikedPostIds(likedByUser);
        setLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel("realtime:posts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          const newPost = payload.new;
          setPosts((current) => [
            {
              ...newPost,
              profile_username:
                newPost.user_email?.split("@")[0] || "user",
            },
            ...current,
          ]);
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="pt-4 px-3 sm:px-4">
      <section className="card px-3 sm:px-4 md:px-6 py-4 sm:py-5 mb-4 relative overflow-hidden">
        <h1 className="font-serif text-lg sm:text-xl md:text-2xl tracking-tight text-shotzi-cream">
          A soft place for loud feelings.
        </h1>
        <p className="text-xs sm:text-sm text-shotzi-silver/90 mt-2 max-w-2xl">
          Dump sunsets, late-night streets, campus chaos, tiny details and random beauty.
        </p>
        <p className="text-[10px] sm:text-[11px] text-shotzi-silver/70 mt-3">
          Tip: treat it like a public camera roll of things that make you feel something.
        </p>
      </section>

      {loading ? (
        <div className="text-center text-xs sm:text-sm text-shotzi-silver/80 py-16">
          Loading your global dump feed...
        </div>
      ) : (
        <PostGrid
          posts={posts}
          currentUser={user}
          likedPostIds={likedPostIds}
          likeCountMap={likeCountMap}
          commentCountMap={commentCountMap}
        />
      )}
    </div>
  );
}
