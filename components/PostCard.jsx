"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function PostCard({
  post,
  currentUser,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  onDeletePost,
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount || 0);
  const [busy, setBusy] = useState(false);

  const createdAt = post.created_at ? new Date(post.created_at) : null;
  const profileSlug = post.profile_username || post.user_id;

  const handleLike = async () => {
    if (!currentUser) {
      alert("Login with Google to like shots ✨");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (liked) {
        await supabase
          .from("likes")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("post_id", post.id);
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await supabase.from("likes").insert({
          user_id: currentUser.id,
          post_id: post.id,
        });
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card overflow-hidden flex flex-col group transition-all hover:shadow-lg">
      <Link href={`/post/${post.id}`} className="block relative">
        <div className="aspect-[4/5] w-full overflow-hidden bg-shotzi-ink">
          <img
            src={post.image_url}
            alt={post.caption || "Shotzi post"}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110"
            loading="lazy"
          />
        </div>
        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-shotzi-ink/85 px-2.5 py-1 text-[9px] sm:text-[10px] text-shotzi-cream shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-shotzi-wine flex-shrink-0" />
          <span className="truncate">{profileSlug}</span>
        </div>
      </Link>

      <div className="p-2 sm:p-3 flex flex-col gap-2">
        {post.caption && (
          <p className="text-xs sm:text-sm text-shotzi-cream line-clamp-2">
            {post.caption}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-shotzi-silver/80 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={handleLike}
                disabled={busy}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 sm:px-2.5 py-1 border text-[10px] sm:text-[11px] transition-all active:scale-95 min-h-[32px]",
                  liked
                    ? "border-shotzi-wine bg-shotzi-wine/70 text-shotzi-cream"
                    : "border-shotzi-sand/50 bg-shotzi-ink hover:bg-shotzi-wine/30"
                )}
                title={liked ? "Unlike" : "Like"}
              >
                <span>{liked ? "♥" : "♡"}</span>
                <span>{likeCount}</span>
              </button>
              <Link
                href={`/post/${post.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-shotzi-sand/50 bg-shotzi-ink px-2 sm:px-2.5 py-1 hover:bg-shotzi-ink/60 transition-all active:scale-95 min-h-[32px]"
                title="View comments"
              >
                <span>💬</span>
                <span>{initialCommentCount || 0}</span>
              </Link>
              {currentUser && currentUser.id === post.user_id && (
                <button
                  type="button"
                  onClick={() => onDeletePost && onDeletePost(post.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-red-500/50 bg-red-900/20 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] text-red-300 hover:bg-red-900/40 transition-all active:scale-95 min-h-[32px]"
                  title="Delete post"
                >
                  <span>🗑️</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <Link
              href={`/u/${profileSlug}`}
              className="text-[10px] sm:text-[11px] hover:text-shotzi-cream transition text-shotzi-silver/80"
              title="View profile"
            >
              @{profileSlug}
            </Link>
            {createdAt && (
              <span className="text-[9px] sm:text-[10px] text-shotzi-silver/60">
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
