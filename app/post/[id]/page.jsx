"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function PostDetailPage() {
  const { id } = useParams();

  const [post, setPost] = useState(null);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);

  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // comment id we’re replying to

  const [loading, setLoading] = useState(true);
  const [busyLike, setBusyLike] = useState(false);
  const [busyComment, setBusyComment] = useState(false);
  const [busyCommentLikes, setBusyCommentLikes] = useState({}); // per–comment like busy

  const [highlightId, setHighlightId] = useState(null); // for “new comment” animation
  const textareaRef = useRef(null);

  // =========================
  // LOAD POST + COMMENTS
  // =========================
  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const cu = userData?.user ?? null;
      if (!ignore) setUser(cu);

      // Post
      const { data: postRow } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();

      if (!postRow) {
        if (!ignore) {
          setPost(null);
          setLoading(false);
        }
        return;
      }

      // Author profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", postRow.user_id)
        .single();

      // Current user's profile (for comment posting display)
      let currentUserProfile = null;
      if (cu) {
        const { data: cup } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", cu.id)
          .maybeSingle();
        currentUserProfile = cup || null;
      }

      // Post likes
      const { data: likeRows } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", id);

      // Comments (flat)
      const { data: commentRows } = await supabase
        .from("comments")
        .select("id, post_id, user_id, user_email, content, created_at, parent_id")
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      // Comment likes
      const commentIds = (commentRows || []).map((c) => c.id);
      let commentLikeRows = [];
      if (commentIds.length) {
        const { data } = await supabase
          .from("comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds);
        commentLikeRows = data || [];
      }

      // Build like counts & “liked by me” map
      const commentLikeCount = {};
      const likedCommentsByUser = new Set();

      for (const row of commentLikeRows) {
        commentLikeCount[row.comment_id] =
          (commentLikeCount[row.comment_id] || 0) + 1;
        if (cu && row.user_id === cu.id) {
          likedCommentsByUser.add(row.comment_id);
        }
      }

      // Fetch profiles for comment authors to display proper names
      let commentAuthorProfiles = [];
      const commenterIds = Array.from(new Set((commentRows || []).map((c) => c.user_id).filter(Boolean)));
      if (commenterIds.length) {
        const { data: caps } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", commenterIds);
        commentAuthorProfiles = caps || [];
      }

      if (!ignore) {
        setPost(postRow);
        setProfile(prof);
        setLikes(likeRows?.length || 0);
        setLiked(cu ? likeRows?.some((row) => row.user_id === cu.id) : false);

        setComments(
          (commentRows || []).map((c) => {
            const author = commentAuthorProfiles.find((p) => p.id === c.user_id);
            // Prefer username (like Instagram) for comment display, fall back to display_name then email local-part
            const profile_username = author?.username || author?.display_name || c.user_email?.split("@")[0] || c.user_id.slice(0, 6);
            const authorUsername = author?.username || author?.id || c.user_id;
            return {
              ...c,
              profile_username,
              authorUsername,
              likeCount: commentLikeCount[c.id] || 0,
              likedByUser: likedCommentsByUser.has(c.id),
            };
          })
        );

        setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [id]);

  // =========================
  // POST LIKE
  // =========================
  const handleLike = async () => {
    if (!user || busyLike || !post) return;
    setBusyLike(true);

    try {
      if (liked) {
        await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", post.id);

        setLiked(false);
        setLikes((c) => Math.max(0, c - 1));
      } else {
        await supabase.from("likes").insert({
          user_id: user.id,
          post_id: post.id,
        });

        setLiked(true);
        setLikes((c) => c + 1);
      }
    } finally {
      setBusyLike(false);
    }
  };

  // =========================
  // COMMENT LIKE
  // =========================
  const handleCommentLike = async (commentId) => {
    if (!user) {
      alert("Login to like comments.");
      return;
    }
    if (busyCommentLikes[commentId]) return;

    setBusyCommentLikes((prev) => ({ ...prev, [commentId]: true }));

    const target = comments.find((c) => c.id === commentId);
    if (!target) {
      setBusyCommentLikes((prev) => ({ ...prev, [commentId]: false }));
      return;
    }

    try {
      if (target.likedByUser) {
        // unlike
        await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likedByUser: false,
                  likeCount: Math.max(0, c.likeCount - 1),
                }
              : c
          )
        );
      } else {
        // like
        await supabase.from("comment_likes").insert({
          comment_id: commentId,
          user_id: user.id,
        });

        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likedByUser: true,
                  likeCount: c.likeCount + 1,
                }
              : c
          )
        );
      }
    } finally {
      setBusyCommentLikes((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  // =========================
  // COMMENT DELETE
  // =========================
  const handleDeleteComment = async (commentId) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await supabase.from("comments").delete().eq("id", commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error(error);
      alert("Failed to delete comment.");
    }
  };
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Login first to comment.");
      return;
    }
    if (!commentText.trim() || busyComment) return;

    setBusyComment(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: post.id,
        user_id: user.id,
        user_email: user.email,
        content: commentText.trim(),
        parent_id: replyTo, // null = top–level, otherwise reply
      })
      .select()
      .single();

    if (error) {
      console.error("COMMENT ERROR:", error);
      alert(error.message);
      setBusyComment(false);
      return;
    }

    const formatted = {
      ...data,
      profile_username: data.user_email?.split("@")[0] || data.user_id.slice(0, 6),
      likeCount: 0,
      likedByUser: false,
    };

    // Try to resolve a nicer display name from profiles table
    try {
      const { data: authorProf } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", data.user_id)
        .maybeSingle();
      if (authorProf) {
      // Prefer username for display
      formatted.profile_username = authorProf.username || authorProf.display_name || formatted.profile_username;
      formatted.authorUsername = authorProf.username || authorProf.id;
      }
    } catch (e) {}

    setComments((prev) => [...prev, formatted]);
    setCommentText("");
    setReplyTo(null);
    setBusyComment(false);

    // small highlight animation for new comment
    setHighlightId(formatted.id);
    setTimeout(() => setHighlightId(null), 700);
  };

  // =========================
  // HELPERS
  // =========================
  const startReply = (commentId) => {
    const c = comments.find((com) => com.id === commentId);
    setReplyTo(commentId);
    if (c) {
      setCommentText(`@${c.profile_username} `);
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const cancelReply = () => {
    setReplyTo(null);
    setCommentText("");
  };

  const buildThread = () => {
    const byParent = {};
    comments.forEach((c) => {
      const key = c.parent_id || "root";
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(c);
    });
    return byParent;
  };

  const threadsByParent = buildThread();

  const renderComments = (parentId = null, level = 0) => {
    const list = threadsByParent[parentId || "root"] || [];
    if (!list.length) return null;

    return (
      <ul className={clsx("space-y-2", level > 0 && "mt-1")}>
        {list.map((c) => {
          const createdAt = c.created_at
            ? formatDistanceToNow(new Date(c.created_at), {
                addSuffix: true,
              })
            : null;

          return (
            <li
              key={c.id}
              className={clsx(
                "rounded-2xl px-3 py-2 text-[11px] flex flex-col gap-1 border border-shotzi-sand/25 bg-shotzi-ink/60 shadow-sm",
                level > 0 && "ml-4 border-l-2 border-l-shotzi-wine/70",
                highlightId === c.id && "animate-pulse"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                  <Link
                    href={`/u/${c.authorUsername || c.user_id}`}
                    className="font-semibold text-shotzi-cream hover:underline"
                    title={`View ${c.profile_username}'s profile`}
                  >
                    @{c.profile_username}
                  </Link>
                  {createdAt && (
                    <span className="text-[9px] text-shotzi-silver/80">
                      {createdAt}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCommentLike(c.id)}
                    disabled={busyCommentLikes[c.id]}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition",
                      c.likedByUser
                        ? "border-shotzi-wine bg-shotzi-wine/80 text-shotzi-cream"
                        : "border-shotzi-sand/40 text-shotzi-cream hover:bg-shotzi-ink"
                    )}
                  >
                    <span>{c.likedByUser ? "♥" : "♡"}</span>
                    <span>{c.likeCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startReply(c.id)}
                    className="text-[10px] text-shotzi-silver/85 hover:text-shotzi-cream underline-offset-2 hover:underline"
                  >
                    Reply
                  </button>
                  {user && (user.id === c.user_id || user.id === post.user_id) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-[10px] text-red-400 hover:text-red-300 underline-offset-2 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <p className="text-shotzi-cream/90 whitespace-pre-line">
                {c.content}
              </p>

              {/* children */}
              {renderComments(c.id, level + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  // =========================
  // RENDER
  // =========================
  if (loading) {
    return (
      <div className="pt-10 text-center text-sm text-shotzi-silver/80">
        Loading shot...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="pt-10 text-center text-sm text-shotzi-silver/80">
        Shot not found.
      </div>
    );
  }

  const profileSlug = profile?.username || post.user_id;
  const createdAt = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : null;

  return (
    <div className="pt-6 pb-10 max-w-6xl mx-auto grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* LEFT: IMAGE */}
      <section className="card overflow-hidden flex items-center justify-center bg-shotzi-ink">
        <img
          src={post.image_url}
          alt={post.caption || "Shotzi post"}
          className="max-h-[80vh] w-full object-contain"
        />
      </section>

      {/* RIGHT: META + COMMENTS */}
      <section className="flex flex-col gap-4">
        {/* POST HEADER */}
        <div className="card px-4 py-3 sm:px-5 sm:py-4 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 decor-spot opacity-40">
            <img src="/decor/leaves-soft.svg" alt="" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Link
                href={`/u/${profileSlug}`}
                className="text-xs font-semibold text-shotzi-cream hover:underline"
              >
                @{profileSlug}
              </Link>
              {profile?.display_name && (
                <div className="text-[11px] text-shotzi-silver/85">
                  {profile.display_name}
                </div>
              )}
              {createdAt && (
                <div className="text-[10px] text-shotzi-silver/80">
                  {createdAt}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLike}
                disabled={busyLike}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition shadow-sm",
                  liked
                    ? "border-shotzi-wine bg-shotzi-wine text-shotzi-cream"
                    : "border-shotzi-sand/50 bg-shotzi-ink text-shotzi-cream hover:bg-shotzi-wine/30"
                )}
              >
                <span>{liked ? "♥" : "♡"}</span>
                <span>
                  {likes} like{likes === 1 ? "" : "s"}
                </span>
              </button>
              {user && user.id === post.user_id && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this post?")) {
                      supabase.from("posts").delete().eq("id", post.id).then(() => {
                        window.location.href = "/";
                      });
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-300 hover:bg-red-900/40 transition shadow-sm"
                >
                  <span>🗑️</span>
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {post.caption && (
            <p className="mt-3 text-xs text-shotzi-cream/95 whitespace-pre-line">
              {post.caption}
            </p>
          )}
        </div>

        {/* COMMENTS */}
        <div className="card px-4 py-3 sm:px-5 sm:py-4 space-y-3 max-h-[70vh] overflow-y-auto soft-scroll">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-shotzi-cream flex items-center gap-2">
              Comments
              <span className="rounded-full bg-shotzi-ink/80 px-2 py-[2px] text-[10px] text-shotzi-silver/80">
                {comments.length}
              </span>
            </h2>
          </div>

          {comments.length === 0 && (
            <p className="text-[11px] text-shotzi-silver/80">
              No comments yet. Be the first to drop something kind.
            </p>
          )}

          {/* threaded comments */}
          {renderComments()}

          {/* REPLY BANNER */}
          {replyTo && (
            <div className="mt-2 mb-1 flex items-center justify-between rounded-xl bg-shotzi-ink/80 px-3 py-2 text-[10px] text-shotzi-silver/85">
              <span>
                Replying to{" "}
                <b>
                  @
                  {
                    comments.find((c) => c.id === replyTo)?.profile_username ??
                    "user"
                  }
                </b>
              </span>
              <button
                type="button"
                onClick={cancelReply}
                className="text-shotzi-cream/90 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* COMMENT FORM */}
          <form onSubmit={handleCommentSubmit} className="pt-1 space-y-2">
            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-shotzi-sand/40 bg-shotzi-ink/80 px-3 py-2 text-[11px] text-shotzi-cream outline-none focus:border-shotzi-cream/70 soft-scroll"
              placeholder={
                user
                  ? replyTo
                    ? "Write a gentle reply..."
                    : "Say something wholesome. No hate, no cringe."
                  : "Login with Google to comment."
              }
              disabled={!user}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  busyComment || !commentText.trim() || !user
                }
                className="rounded-full bg-shotzi-cream text-shotzi-ink px-3 py-1.5 text-[11px] font-semibold hover:bg-shotzi-sand disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {busyComment
                  ? replyTo
                    ? "Replying..."
                    : "Posting..."
                  : replyTo
                  ? "Reply"
                  : "Comment"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
