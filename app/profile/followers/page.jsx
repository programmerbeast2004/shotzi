"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import FollowerCard from "../../../components/FollowerCard";
import { supabase } from "../../../lib/supabaseClient";

export default function FollowersPage() {
  const [user, setUser] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingIds, setUnfollowingIds] = useState(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewedUserId = searchParams?.get("user") || null;
  const [reloadFlag, setReloadFlag] = useState(0);

  useEffect(() => {
    async function loadFollowers() {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user ?? null;

      // allow unauthenticated visitors to view someone else's followers
      setUser(u);

      const targetId = viewedUserId || u?.id;
      if (!targetId) {
        // nothing to show
        setFollowers([]);
        setLoading(false);
        return;
      }

      // Get followers for target user
      const { data: followerData, error } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", targetId);

      if (error) {
        console.error("Error loading followers:", error);
        setFollowers([]);
      } else {
        // Get profile data for each follower
        const followerIds = (followerData || []).map(f => f.follower_id);

        if (followerIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, bio")
            .in("id", followerIds);

          if (profilesError) {
            console.error("Error loading follower profiles:", profilesError);
            setFollowers([]);
          } else {
            // Combine follow data with profile data
            const followersWithProfiles = (followerData || []).map(follow => {
              const profile = (profilesData || []).find(p => p.id === follow.follower_id);
              return {
                follower_id: follow.follower_id,
                profiles: profile || null
              };
            });
            setFollowers(followersWithProfiles);
          }
        } else {
          setFollowers([]);
        }
      }

      setLoading(false);
    }

    loadFollowers();
  }, [router, viewedUserId, reloadFlag]);

  // listen for follow/unfollow events from other tabs/pages
  useEffect(() => {
    function onStorage(e) {
      if (!e) return;
      try {
        if (e.key === "shotzi_follow_update") {
          const payload = JSON.parse(e.newValue || e.oldValue || "null");
          if (!payload) return;
          const targetId = viewedUserId || user?.id;
          if (payload.profileId && targetId && payload.profileId === targetId) {
            // trigger reload
            setReloadFlag((v) => v + 1);
          }
        } else if (e.key === "shotzi_following_update") {
          const payload = JSON.parse(e.newValue || e.oldValue || "null");
          if (!payload) return;
          const targetId = viewedUserId || user?.id;
          // if viewing your own following list, reload when your following changes
          if (payload.userId && targetId && payload.userId === targetId) {
            setReloadFlag((v) => v + 1);
          }
        }
      } catch (err) {}
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [viewedUserId, user]);


  // Realtime subscription to update followers list immediately
  useEffect(() => {
    const targetId = viewedUserId || user?.id;
    if (!targetId) return;

    const ch = supabase
      .channel(`follows_list_followers_${targetId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "follows", filter: `following_id=eq.${targetId}` },
        () => setReloadFlag((v) => v + 1)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "follows", filter: `following_id=eq.${targetId}` },
        () => setReloadFlag((v) => v + 1)
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(ch); } catch (e) {}
    };
  }, [viewedUserId, user]);

  const handleRemoveFollower = async (followerId) => {
    // only allow removing when viewing your own followers
    const targetId = viewedUserId || user?.id;
    if (!user || user.id !== targetId) {
      alert("You can only remove followers from your own list.");
      return;
    }

    setUnfollowingIds(prev => new Set([...prev, followerId]));

    try {
      // Delete the follow relationship
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("following_id", targetId);

      // Remove from local state
      setFollowers(prev => prev.filter(f => f.follower_id !== followerId));
    } catch (error) {
      console.error("Error removing follower:", error);
      alert("Failed to remove follower");
    } finally {
      setUnfollowingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(followerId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-shotzi-ink to-shotzi-ink/90">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="text-4xl">✨</div>
          </div>
          <p className="text-shotzi-cream text-lg">Loading your followers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-shotzi-ink to-shotzi-ink/90">
      {/* Background Decorative Elements */}
      <div className="fixed -top-10 -left-10 w-40 h-40 opacity-5">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="50" fill="currentColor" className="text-shotzi-wine" />
        </svg>
      </div>
      <div className="fixed -bottom-20 -right-20 w-52 h-52 opacity-5">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d="M50 0 L100 50 L50 100 L0 50 Z" fill="currentColor" className="text-shotzi-wine" />
        </svg>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-shotzi-cream hover:text-shotzi-silver hover:bg-shotzi-ink/50 transition-all duration-200 active:scale-95"
              title="Go back"
            >
              ←
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-shotzi-cream">
                Your Followers
              </h1>
              <p className="text-sm text-shotzi-silver/80 mt-1">
                {followers.length} {followers.length === 1 ? "person is" : "people are"} following you
              </p>
            </div>
          </div>
        </div>

        {/* Followers List */}
        {followers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-7xl mb-6 opacity-80">👥</div>
            <h2 className="text-2xl font-serif text-shotzi-cream mb-2">No followers yet</h2>
            <p className="text-shotzi-silver/80 text-center max-w-sm mb-6">
              Share your profile and start building your community. Your followers will appear here!
            </p>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-shotzi-wine/20 hover:bg-shotzi-wine/30 border border-shotzi-wine/30 rounded-full text-shotzi-cream transition-all duration-200 active:scale-95"
            >
              Back to Profile
            </button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 items-stretch">
            {followers.map((follow) => {
              const profile = follow.profiles;
              if (!profile) return null;

              const isRemoving = unfollowingIds.has(follow.follower_id);

              const showAction = user && (viewedUserId || user.id) === user.id;

              return (
                <FollowerCard
                  key={follow.follower_id}
                  profile={profile}
                  onAction={showAction ? () => handleRemoveFollower(follow.follower_id) : undefined}
                  actionTitle="Remove follower"
                  actionDisabled={isRemoving}
                  onVisit={() => router.push(`/u/${profile.username || profile.id}`)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}