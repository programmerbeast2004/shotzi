"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function UploadPage() {
  const [user, setUser] = useState(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!ignore) {
        setUser(data?.user ?? null);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Only image files are allowed right now.");
      return;
    }
    setFile(f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Login first.");
      return;
    }
    if (!file) {
      alert("Select an image.");
      return;
    }

    try {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { data: storageData, error: storageErr } = await supabase.storage
        .from("shots")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (storageErr) {
        console.error(storageErr);
        alert("Upload failed. Check console.");
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("shots").getPublicUrl(storageData.path);

      const { error: insertErr } = await supabase.from("posts").insert({
        image_url: publicUrl,
        caption: caption || null,
        user_id: user.id,
        user_email: user.email,
      });

      if (insertErr) {
        console.error(insertErr);
        alert("Failed to save post.");
        setUploading(false);
        return;
      }

      setCaption("");
      setFile(null);
      router.push("/");
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="pt-4 sm:pt-8 px-3 sm:px-4 max-w-md mx-auto">
        <div className="card p-4 sm:p-6 text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-8 w-32 decor-spot">
            <img src="/decor/stars-soft.svg" alt="" />
          </div>
          <h1 className="font-serif text-base sm:text-lg mb-2 text-shotzi-cream">
            Login to dump a shot
          </h1>
          <p className="text-xs sm:text-sm text-shotzi-silver/85">
            Use the &quot;Login with Google&quot; button in the top bar, then
            come back to turn your camera roll into a tiny gallery of feelings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 sm:pt-6 px-3 sm:px-4 max-w-md mx-auto pb-6">
      <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-4 relative overflow-hidden">
        <div className="absolute -left-6 -top-8 w-32 decor-spot">
          <img src="/decor/flower-soft.svg" alt="" />
        </div>
        <h1 className="font-serif text-base sm:text-lg text-shotzi-cream">
          Dump a new shot
        </h1>
        <p className="text-xs sm:text-sm text-shotzi-silver/85">
          Share a moment, place, or tiny detail that made you pause. No selfies,
          no faces — just the world.
        </p>

        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-shotzi-cream block">
            Image file
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            required
            className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-shotzi-cream file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-shotzi-ink hover:file:bg-shotzi-sand/90 transition-all cursor-pointer min-h-[44px] file:cursor-pointer"
          />
          {file && (
            <p className="text-xs text-shotzi-wine">
              ✓ {file.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-shotzi-cream block">
            Caption (optional)
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-shotzi-sand/40 bg-shotzi-ink/70 px-3 py-2 text-xs sm:text-sm text-shotzi-cream outline-none focus:border-shotzi-cream/70 focus:ring-1 focus:ring-shotzi-cream/30 transition-all placeholder-shotzi-silver/50 min-h-[100px]"
            placeholder="Describe the vibe in your own words..."
          />
        </div>

        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full rounded-full bg-shotzi-wine text-shotzi-cream text-xs sm:text-sm font-semibold px-3 py-2.5 sm:py-3 hover:bg-shotzi-wine/80 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[44px]"
        >
          {uploading ? "Uploading..." : "Dump it"}
        </button>
      </form>
    </div>
  );
}
