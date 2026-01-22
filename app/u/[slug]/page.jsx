"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PostGrid from "../../../components/PostGrid";
import ProfileHeader from "../../../components/ProfileHeader";
import { supabase } from "../../../lib/supabaseClient";

export default function PublicProfilePage() {
  const { slug } = useParams();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [likeCountMap, setLikeCountMap] = useState({});
  const [commentCountMap, setCommentCountMap] = useState({});
  const [likedPostIds, setLikedPostIds] = useState([]);

  // FOLLOW SYSTEM STATES
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      const cu = userData?.user ?? null;
      if (!ignore) setCurrentUser(cu);

      // Load profile by username or id
      let { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", slug)
        .maybeSingle();

      if (!prof) {
        const { data: byId } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", slug)
          .maybeSingle();
        prof = byId;
      }

      if (!prof) {
        if (!ignore) {
          setProfile(null);
          setPosts([]);
          setLikeCountMap({});
          setCommentCountMap({});
          setLikedPostIds([]);
          setFollowerCount(0);
          setFollowingCount(0);
          setIsFollowing(false);
          setLoading(false);
        }
        return;
      }

      // Load follower and following counts
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact" }).eq("following_id", prof.id),
        supabase.from("follows").select("*", { count: "exact" }).eq("follower_id", prof.id),
      ]);

      if (!ignore) {
        setFollowerCount(followers || 0);
        setFollowingCount(following || 0);
      }

      // Check if current user follows this profile
      if (cu) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", cu.id)
          .eq("following_id", prof.id)
          .maybeSingle();

        if (!ignore) setIsFollowing(!!followRow);
      }

      // Load posts
      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", prof.id)
        .order("created_at", { ascending: false });

      const postIds = (postsData || []).map((p) => p.id);

      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        postIds.length
          ? supabase.from("likes").select("post_id, user_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from("comments").select("post_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
      ]);

      const likeCounts = {};
      const liked = [];
      (likeRows || []).forEach((row) => {
        likeCounts[row.post_id] = (likeCounts[row.post_id] || 0) + 1;
        if (cu && row.user_id === cu.id) liked.push(row.post_id);
      });

      const commentCounts = {};
      (commentRows || []).forEach((row) => {
        commentCounts[row.post_id] = (commentCounts[row.post_id] || 0) + 1;
      });

      if (!ignore) {
        setProfile(prof);
        setPosts(
          (postsData || []).map((p) => ({
            ...p,
            profile_username: prof.username || prof.id?.slice(0, 8),
          }))
        );
        setLikeCountMap(likeCounts);
        setCommentCountMap(commentCounts);
        setLikedPostIds(liked);
        setLoading(false);
      }
    }

    if (slug) load();
    return () => {
      ignore = true;
    };
  }, [slug]);

  // Realtime updates for follower & following counts
  useEffect(() => {
    if (!profile) return;

    const channelFollowers = supabase
      .channel(`follows_profile_${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "follows", filter: `following_id=eq.${profile.id}` },
        () => setFollowerCount((c) => c + 1)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "follows", filter: `following_id=eq.${profile.id}` },
        () => setFollowerCount((c) => Math.max(0, c - 1))
      )
      .subscribe();

    const channelFollowing = supabase
      .channel(`follows_profile_following_${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "follows", filter: `follower_id=eq.${profile.id}` },
        () => setFollowingCount((c) => c + 1)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "follows", filter: `follower_id=eq.${profile.id}` },
        () => setFollowingCount((c) => Math.max(0, c - 1))
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channelFollowers); } catch (e) {}
      try { supabase.removeChannel(channelFollowing); } catch (e) {}
    };
  }, [profile]);

  // Follow / Unfollow action
  const toggleFollow = async () => {
    if (!currentUser) {
      alert("Login to follow");
      return;
    }

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", profile.id);
      const newCount = Math.max(0, followerCount - 1);
      setIsFollowing(false);
      setFollowerCount(newCount);
      try {
        localStorage.setItem(
          "shotzi_follow_update",
          JSON.stringify({ profileId: profile.id, followerCount: newCount, ts: Date.now() })
        );
        localStorage.setItem(
          "shotzi_following_update",
          JSON.stringify({ userId: currentUser.id, delta: -1, ts: Date.now() })
        );
      } catch (e) {}
    } else {
      await supabase.from("follows").insert({
        follower_id: currentUser.id,
        following_id: profile.id,
      });
      const newCount = followerCount + 1;
      setIsFollowing(true);
      setFollowerCount(newCount);
      try {
        localStorage.setItem(
          "shotzi_follow_update",
          JSON.stringify({ profileId: profile.id, followerCount: newCount, ts: Date.now() })
        );
        localStorage.setItem(
          "shotzi_following_update",
          JSON.stringify({ userId: currentUser.id, delta: 1, ts: Date.now() })
        );
      } catch (e) {}
    }
  };

  if (loading) {
    return (
      <div className="pt-8 text-center text-sm text-shotzi-silver/80">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-8 max-w-md mx-auto">
        <div className="card p-6 text-center">
          <h1 className="font-serif text-lg mb-2 text-shotzi-cream">Profile not found</h1>
          <p className="text-xs text-shotzi-silver/85">This user doesn&apos;t exist on Shotzi yet.</p>
        </div>
      </div>
    );
  }

  const isOwn = currentUser && currentUser.id === profile.id;
  const totalLikes = Object.values(likeCountMap).reduce((a, b) => a + b, 0);
  const totalComments = Object.values(commentCountMap).reduce((a, b) => a + b, 0);

  return (
    <div className="pt-4">
      <ProfileHeader
        profile={profile}
        isOwn={isOwn}
        isFollowing={isFollowing}
        followerCount={followerCount}
        followingCount={followingCount}
        postsCount={posts.length}
        onFollow={toggleFollow}
        onEditClick={isOwn ? () => (window.location.href = "/profile") : undefined}
        onDeleteClick={
          isOwn
            ? () => {
                if (confirm("Are you sure you want to delete your profile?")) {
                  supabase.from("posts").delete().eq("user_id", currentUser.id);
                  supabase.from("profiles").delete().eq("id", currentUser.id);
                  supabase.auth.signOut();
                  window.location.href = "/";
                }
              }
            : undefined
        }
      />

      <section className="card px-4 py-3 sm:px-6 sm:py-4 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-shotzi-cream">{isOwn ? "Your public dump" : "Public dump"}</h2>
        <p className="text-[11px] text-shotzi-silver/80">
          {posts.length} shots • {totalLikes} likes • {totalComments} comments • {followerCount} followers • {followingCount} following
        </p>
      </section>

      <PostGrid
        posts={posts}
        currentUser={currentUser}
        likedPostIds={likedPostIds}
        likeCountMap={likeCountMap}
        commentCountMap={commentCountMap}
        onDeletePost={async (postId) => {
          if (!confirm("Are you sure you want to delete this post?")) return;
          try {
            await supabase.from("posts").delete().eq("id", postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch (error) {
            console.error(error);
            alert("Failed to delete post.");
          }
        }}
      />
    </div>
  );
}
