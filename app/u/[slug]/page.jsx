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

  // ✅ FOLLOW SYSTEM STATES
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);

      // ✅ Get Current User
      const { data: userData } = await supabase.auth.getUser();
      const cu = userData?.user ?? null;
      if (!ignore) setCurrentUser(cu);

      // ✅ Get Profile by Username OR ID
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
          setIsFollowing(false);
          setLoading(false);
        }
        return;
      }

      // ✅ Load Followers Count
      const { count } = await supabase
        .from("follows")
        .select("*", { count: "exact" })
        .eq("following_id", prof.id);

      if (!ignore) setFollowerCount(count || 0);

      // ✅ Check If Current User Follows This Profile
      if (cu) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", cu.id)
          .eq("following_id", prof.id)
          .maybeSingle();

        if (!ignore) setIsFollowing(!!followRow);
      }

      // ✅ Load Posts
      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", prof.id)
        .order("created_at", { ascending: false });

      const postIds = (postsData || []).map((p) => p.id);

      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        postIds.length
          ? supabase
              .from("likes")
              .select("post_id, user_id")
              .in("post_id", postIds)
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

  // ✅ FOLLOW / UNFOLLOW ACTION
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

      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("follows").insert({
        follower_id: currentUser.id,
        following_id: profile.id,
      });

      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
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
          <h1 className="font-serif text-lg mb-2 text-shotzi-cream">
            Profile not found
          </h1>
          <p className="text-xs text-shotzi-silver/85">
            This user doesn&apos;t exist on Shotzi yet.
          </p>
        </div>
      </div>
    );
  }

  const isOwn = currentUser && currentUser.id === profile.id;
  const totalLikes = Object.values(likeCountMap).reduce((a, b) => a + b, 0);
  const totalComments = Object.values(commentCountMap).reduce((a, b) => a + b, 0);

  return (
    <div className="pt-4">
      {/* ✅ PROFILE HEADER + FOLLOW */}
      <ProfileHeader
        profile={profile}
        isOwn={isOwn}
        isFollowing={isFollowing}
        followerCount={followerCount}
        onFollow={toggleFollow}
      />

      <section className="card px-4 py-3 sm:px-6 sm:py-4 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-shotzi-cream">
          {isOwn ? "Your public dump" : "Public dump"}
        </h2>
        <p className="text-[11px] text-shotzi-silver/80">
          {posts.length} shots • {totalLikes} likes • {totalComments} comments •{" "}
          {followerCount} followers
        </p>
      </section>

      <PostGrid
        posts={posts}
        currentUser={currentUser}
        likedPostIds={likedPostIds}
        likeCountMap={likeCountMap}
        commentCountMap={commentCountMap}
      />
    </div>
  );
}
