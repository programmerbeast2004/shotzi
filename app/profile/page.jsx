"use client";

import { useEffect, useState } from "react";
import PostGrid from "../../components/PostGrid";
import ProfileHeader from "../../components/ProfileHeader";
import { supabase } from "../../lib/supabaseClient";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    header_image_url: "",
    avatar_url: "",
  });

  const [likeCountMap, setLikeCountMap] = useState({});
  const [commentCountMap, setCommentCountMap] = useState({});
  const [likedPostIds, setLikedPostIds] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user ?? null;
      if (!u) {
        if (!ignore) setLoading(false);
        return;
      }
      if (ignore) return;
      setUser(u);

      let { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (!prof) {
        const username = u.email?.split("@")[0] || `user_${u.id.slice(0, 8)}`;
        const { data: inserted } = await supabase
          .from("profiles")
          .insert({
            id: u.id,
            username,
            display_name: username,
          })
          .select("*")
          .single();
        prof = inserted;
      }

      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", u.id)
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
        if (row.user_id === u.id) liked.push(row.post_id);
      });

      const commentCounts = {};
      (commentRows || []).forEach((row) => {
        commentCounts[row.post_id] = (commentCounts[row.post_id] || 0) + 1;
      });

      if (!ignore) {
        setProfile(prof);

setForm({
  display_name: prof?.display_name || "",
  username: prof?.username || "",
  bio: prof?.bio || "",
  header_image_url: prof?.header_image_url || "",
  avatar_url: prof?.avatar_url || "",
});

        setPosts(postsData || []);
        setLikeCountMap(likeCounts);
        setCommentCountMap(commentCounts);
        setLikedPostIds(liked);
        setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  const onFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        username: form.username || null,
        bio: form.bio || null,
        header_image_url: form.header_image_url || null,
        avatar_url: form.avatar_url || null,
      })
      .eq("id", user.id);
    if (error) {
      console.error(error);
      alert("Failed to save profile. Maybe username already taken?");
      return;
    }
    setProfile((p) => ({ ...p, ...form }));
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="pt-8 px-4 text-center text-sm text-shotzi-silver/80">
        Loading your profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pt-4 sm:pt-8 px-3 sm:px-4 max-w-md mx-auto">
        <div className="card p-4 sm:p-6 text-center">
          <h1 className="font-serif text-base sm:text-lg mb-2 text-shotzi-cream">
            Login to see your profile
          </h1>
          <p className="text-xs sm:text-sm text-shotzi-silver/85">
            Hit &quot;Login with Google&quot; in the top-right corner first.
          </p>
        </div>
      </div>
    );
  }

  const totalLikes = Object.values(likeCountMap).reduce((a, b) => a + b, 0);
  const totalComments = Object.values(commentCountMap).reduce((a, b) => a + b, 0);

  return (
    <div className="pt-4">
      <ProfileHeader
        profile={profile}
        isOwn
        onEditClick={() => setEditMode((v) => !v)}
      />

      {editMode && (
        <form
          onSubmit={onSaveProfile}
          className="card p-3 sm:p-5 mb-4 mx-3 sm:mx-0 space-y-3 text-xs sm:text-sm"
        >
          <h3 className="font-semibold text-shotzi-cream text-sm sm:text-base">
            Edit Your Profile
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="font-medium text-shotzi-cream block text-xs sm:text-sm">
                Display name
              </label>
              <input
                className="w-full rounded-2xl border border-shotzi-sand/40 bg-shotzi-ink/70 px-3 py-2 outline-none focus:border-shotzi-cream/70 focus:ring-1 focus:ring-shotzi-cream/30 text-shotzi-cream text-xs sm:text-sm transition-all min-h-[40px]"
                value={form.display_name}
                onChange={(e) => onFormChange("display_name", e.target.value)}
                placeholder="What should Shotzi call you?"
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-shotzi-cream block text-xs sm:text-sm">
                Username
              </label>
              <input
                className="w-full rounded-2xl border border-shotzi-sand/40 bg-shotzi-ink/70 px-3 py-2 outline-none focus:border-shotzi-cream/70 focus:ring-1 focus:ring-shotzi-cream/30 text-shotzi-cream text-xs sm:text-sm transition-all min-h-[40px]"
                value={form.username}
                onChange={(e) => onFormChange("username", e.target.value)}
                placeholder="used in /u/username links"
              />
              <p className="text-[10px] text-shotzi-silver/80">
                Keep it simple, like <code>sunset_god</code> or <code>chaotic_dev</code>.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-medium text-shotzi-cream block text-xs sm:text-sm">
              Bio
            </label>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-shotzi-sand/40 bg-shotzi-ink/70 px-3 py-2 outline-none focus:border-shotzi-cream/70 focus:ring-1 focus:ring-shotzi-cream/30 text-shotzi-cream text-xs sm:text-sm transition-all resize-none"
              value={form.bio}
              onChange={(e) => onFormChange("bio", e.target.value)}
              placeholder="One line soft flex, one line gentle chaos."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="font-medium text-shotzi-cream block text-xs sm:text-sm">
                Header image URL (optional)
              </label>
              <input
                className="w-full rounded-2xl border border-shotzi-sand/40 bg-shotzi-ink/70 px-3 py-2 outline-none focus:border-shotzi-cream/70 focus:ring-1 focus:ring-shotzi-cream/30 text-shotzi-cream text-xs sm:text-sm transition-all min-h-[40px]"
                value={form.header_image_url}
                onChange={(e) =>
                  onFormChange("header_image_url", e.target.value)
                }
                placeholder="Any public banner image URL"
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-shotzi-cream block text-xs sm:text-sm">
                Avatar image URL (optional)
              </label>
              <input
                className="w-full rounded-2xl border border-shotzi-sand/40 bg-shotzi-ink/70 px-3 py-2 outline-none focus:border-shotzi-cream/70 focus:ring-1 focus:ring-shotzi-cream/30 text-shotzi-cream text-xs sm:text-sm transition-all min-h-[40px]"
                value={form.avatar_url}
                onChange={(e) => onFormChange("avatar_url", e.target.value)}
                placeholder="Square pic, illustration, logo..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="rounded-full border border-shotzi-sand/40 bg-shotzi-ink/70 px-3 py-2 text-xs sm:text-sm text-shotzi-cream hover:bg-shotzi-ink transition-all active:scale-95 min-h-[40px] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-shotzi-cream text-shotzi-ink px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-shotzi-sand transition-all active:scale-95 min-h-[40px]"
            >
              Save profile
            </button>
          </div>
        </form>
      )}

      <section className="card px-3 sm:px-6 py-3 sm:py-4 mb-3 mx-3 sm:mx-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-sm sm:text-base font-semibold text-shotzi-cream">
            Your shots
          </h2>
          <p className="text-xs sm:text-sm text-shotzi-silver/80">
            <span className="inline">{posts.length} uploaded</span>
            <span className="mx-2 text-shotzi-sand/50">•</span>
            <span className="inline">{totalLikes} likes</span>
            <span className="mx-2 text-shotzi-sand/50">•</span>
            <span className="inline">{totalComments} comments</span>
          </p>
        </div>
      </section>

      <PostGrid
        posts={posts.map((p) => ({
          ...p,
          profile_username: profile?.username || user.email?.split("@")[0],
        }))}
        currentUser={user}
        likedPostIds={likedPostIds}
        likeCountMap={likeCountMap}
        commentCountMap={commentCountMap}
      />
    </div>
  );
}
