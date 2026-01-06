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
  const [saving, setSaving] = useState(false);

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

  // ✅ LOAD USER + PROFILE
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

      setUser(u);

      let { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      // ✅ AUTO CREATE PROFILE IF MISSING
      if (!prof) {
        const username =
          u.user_metadata?.username ||
          u.email?.split("@")[0] ||
          `user_${u.id.slice(0, 6)}`;

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

  // ✅ ✅ ✅ FINAL SAFE PROFILE SAVE (USERNAME UNIQUE CHECK)
  const onDeletePost = async (postId) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await supabase.from("posts").delete().eq("id", postId);
      // Remove from local state
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      // Update counts if needed, but for simplicity, reload
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Failed to delete post.");
    }
  };

  const onDeleteProfile = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to delete your profile? This action cannot be undone.")) return;

    try {
      // Delete posts first
      await supabase.from("posts").delete().eq("user_id", user.id);
      // Delete profile
      await supabase.from("profiles").delete().eq("id", user.id);
      // Sign out
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      alert("Failed to delete profile.");
    }
  };

  // ✅ ✅ ✅ FINAL SAFE PROFILE SAVE (USERNAME UNIQUE CHECK)
  const onSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    // ✅ CHECK USERNAME UNIQUENESS
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", form.username)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      alert("Username already taken.");
      setSaving(false);
      return;
    }

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

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to save profile.");
      return;
    }

    setProfile((p) => ({ ...p, ...form }));
    setEditMode(false);
    window.location.reload(); // ✅ refresh public data
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
      <div className="pt-4 max-w-md mx-auto">
        <div className="card p-6 text-center">
          <h1 className="font-serif text-lg mb-2 text-shotzi-cream">
            Login to see your profile
          </h1>
        </div>
      </div>
    );
  }

  const totalLikes = Object.values(likeCountMap).reduce((a, b) => a + b, 0);
  const totalComments = Object.values(commentCountMap).reduce((a, b) => a + b, 0);

  return (
    <div className="pt-4">
      <ProfileHeader profile={profile} isOwn onEditClick={() => setEditMode((v) => !v)} onDeleteClick={onDeleteProfile} />

      {editMode && (
        <form
          onSubmit={onSaveProfile}
          className="card p-4 mb-4 space-y-3"
        >
          <h3 className="font-semibold text-shotzi-cream">Edit Profile</h3>

          {["display_name", "username", "bio", "header_image_url", "avatar_url"].map(
            (field) => (
              <input
                key={field}
                className="w-full rounded-xl bg-shotzi-ink border p-2 text-xs text-white"
                placeholder={field.replace(/_/g, " ")}
                value={form[field]}
                onChange={(e) => onFormChange(field, e.target.value)}
              />
            )
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-shotzi-cream text-black px-4 py-2 rounded-full text-sm"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      )}

      <section className="card px-4 py-3 mb-3">
        <h2 className="text-sm font-semibold text-shotzi-cream">Your shots</h2>
        <p className="text-xs text-shotzi-silver/80">
          {posts.length} shots • {totalLikes} likes • {totalComments} comments
        </p>
      </section>

      <PostGrid
        posts={posts.map((p) => ({
          ...p,
          profile_username: profile?.username,
        }))}
        currentUser={user}
        likedPostIds={likedPostIds}
        likeCountMap={likeCountMap}
        commentCountMap={commentCountMap}
        onDeletePost={onDeletePost}
      />
    </div>
  );
}
