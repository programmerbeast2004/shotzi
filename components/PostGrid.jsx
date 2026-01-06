"use client";

import PostCard from "./PostCard";

export default function PostGrid({
  posts,
  currentUser,
  likedPostIds,
  likeCountMap,
  commentCountMap,
  onDeletePost,
}) {
  if (!posts?.length) {
    return (
      <div className="card py-8 sm:py-10 px-4 sm:px-6 text-center text-sm text-shotzi-silver/80 mt-4 mx-3 sm:mx-0 relative overflow-hidden">
        <div className="absolute -left-6 -bottom-8 w-32 decor-spot">
          <img src="/decor/flower-soft.svg" alt="" />
        </div>
        <p className="font-serif text-base sm:text-lg mb-2 text-shotzi-cream">
          It&apos;s quiet here.
        </p>
        <p className="text-xs sm:text-sm">
          No shots yet. Be the first to drop something gentle and gorgeous.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mt-4 px-2 sm:px-0">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          initialLiked={likedPostIds?.includes(post.id)}
          initialLikeCount={likeCountMap?.[post.id] || 0}
          initialCommentCount={commentCountMap?.[post.id] || 0}
          onDeletePost={onDeletePost}
        />
      ))}
    </div>
  );
}
