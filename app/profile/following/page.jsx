"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import FollowerCard from "../../../components/FollowerCard";
// defer importing supabase so it isn't created at module-eval time

export default function FollowingPage() {
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingIds, setUnfollowingIds] = useState(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewedUserId = searchParams?.get("user") || null;
  const [reloadFlag, setReloadFlag] = useState(0);

  useEffect(() => {
    async function loadFollowing() {
      const { supabase } = await import("../../../lib/supabaseClient");
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user ?? null;

      // allow viewing other users' following lists
      setUser(u);

      const targetId = viewedUserId || u?.id;
      if (!targetId) {
        setFollowing([]);
        setLoading(false);
        return;
      }

      // Get following (users target follows)
      const { data: followingData, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", targetId);

      if (error) {
        console.error("Error loading following:", error);
        setFollowing([]);
      } else {
        // Get profile data for each following
        const followingIds = (followingData || []).map(f => f.following_id);

        if (followingIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, bio")
            .in("id", followingIds);

          if (profilesError) {
            console.error("Error loading following profiles:", profilesError);
            setFollowing([]);
          } else {
            // Combine follow data with profile data
            const followingWithProfiles = (followingData || []).map(follow => {
              const profile = (profilesData || []).find(p => p.id === follow.following_id);
              return {
                following_id: follow.following_id,
                profiles: profile || null
              };
            });
            setFollowing(followingWithProfiles);
          }
        } else {
          setFollowing([]);
        }
      }

      setLoading(false);
    }

    loadFollowing();
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
          if (payload.userId && targetId && payload.userId === targetId) {
            // trigger reload when this user's following list changed
            setReloadFlag((v) => v + 1);
          }
        }
      } catch (err) {}
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [viewedUserId, user]);

  // Realtime subscription to update following list immediately
  useEffect(() => {
    const targetId = viewedUserId || user?.id;
    if (!targetId) return;

    let ch = null;
    let sup = null;
    async function subscribe() {
      const mod = await import("../../../lib/supabaseClient");
      sup = mod.supabase;
      ch = sup
        .channel(`follows_list_following_${targetId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "follows", filter: `follower_id=eq.${targetId}` },
          () => setReloadFlag((v) => v + 1)
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "follows", filter: `follower_id=eq.${targetId}` },
          () => setReloadFlag((v) => v + 1)
        )
        .subscribe();
    }

    subscribe();

    return () => {
      try { if (sup && ch) sup.removeChannel(ch); } catch (e) {}
    };
  }, [viewedUserId, user]);

  const handleUnfollow = async (followingId) => {
    const targetId = viewedUserId || user?.id;
    if (!user || user.id !== targetId) {
      alert("You can only unfollow from your own account.");
      return;
    }

    setUnfollowingIds(prev => new Set([...prev, followingId]));

    try {
      const { supabase } = await import("../../../lib/supabaseClient");
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", followingId);

      if (error) {
        console.error("Error unfollowing:", error);
        alert("Failed to unfollow user");
      } else {
        setFollowing(prev => prev.filter(f => f.following_id !== followingId));
      }
    } finally {
      setUnfollowingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(followingId);
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
          <p className="text-shotzi-cream text-lg">Loading your following list...</p>
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
                Following
              </h1>
              <p className="text-sm text-shotzi-silver/80 mt-1">
                {following.length} {following.length === 1 ? "person" : "people"}
              </p>
            </div>
          </div>
        </div>

        {/* Following List */}
        {following.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-7xl mb-6 opacity-80">🔍</div>
            <h2 className="text-2xl font-serif text-shotzi-cream mb-2">Not following anyone yet</h2>
            <p className="text-shotzi-silver/80 text-center max-w-sm mb-6">
              Explore amazing creators and start building your network. Follow people to see their latest content!
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
            {following.map((follow) => {
              const profile = follow.profiles;
              if (!profile) return null;

              const isUnfollowing = unfollowingIds.has(follow.following_id);

              const showAction = user && (viewedUserId || user.id) === user.id;

              return (
                <FollowerCard
                  key={follow.following_id}
                  profile={profile}
                  onAction={showAction ? () => handleUnfollow(follow.following_id) : undefined}
                  actionTitle="Unfollow user"
                  actionDisabled={isUnfollowing}
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