"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); // ✅ mobile menu state

  useEffect(() => {
    let ignore = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!ignore) {
        setUser(data?.user ?? null);
        setLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      ignore = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? window.location.href : undefined,
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-shotzi-sand/40 bg-shotzi-ink/85 backdrop-blur-2xl">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-1 sm:gap-3">

        {/* ✅ LOGO */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="h-10 sm:h-12 w-[120px] sm:w-[160px] rounded-xl border border-shotzi-sand/50 bg-shotzi-ink flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
  <img
    src="https://ideogram.ai/assets/progressive-image/balanced/response/61wHd_tvS8af9kszvolUWQ"
    alt="Shotzi Logo"
    className="h-full w-full object-cover scale-125 sm:scale-150"
  />
</div>


          <div className="leading-tight hidden xs:block">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-serif text-base sm:text-lg tracking-tight text-shotzi-cream">
                Shotzi
              </span>
              <span className="badge hidden sm:inline-flex text-[8px] sm:text-[10px]">
                a soft place for loud feelings
              </span>
            </div>
            <p className="text-[9px] sm:text-[11px] text-shotzi-silver/80 hidden sm:block">
              Pic dump for skies, streets, notes &amp; vibes — never faces.
            </p>
          </div>
        </Link>

        {/* ✅ DESKTOP ACTION BUTTONS */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-2 flex-wrap justify-end">

          <Link href="/upload" className="nav-btn">＋ Dump</Link>
          <Link href="/reels" className="nav-btn">▶ Reels</Link>
          <Link href="/profile" className="nav-btn">◎ Profile</Link>

          {!loading && !user && (
            <button onClick={login} className="nav-primary-btn">
              ⚡ Login
            </button>
          )}

          {!loading && user && (
            <button onClick={logout} className="nav-danger-btn">
              Logout
            </button>
          )}
        </div>

        {/* ✅ MOBILE HAMBURGER */}
        <button
          onClick={() => setOpen(!open)}
          className="sm:hidden text-shotzi-cream text-2xl"
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {/* ✅ MOBILE DROPDOWN MENU */}
      {open && (
        <div className="sm:hidden border-t border-shotzi-sand/30 bg-shotzi-ink px-4 py-4 space-y-3 text-center">

          <Link onClick={() => setOpen(false)} href="/upload" className="block nav-btn">
            ＋ Dump a shot
          </Link>

          <Link onClick={() => setOpen(false)} href="/reels" className="block nav-btn">
            ▶ Infinite 
          </Link>

          <Link onClick={() => setOpen(false)} href="/profile" className="block nav-btn">
            ◎ My profile
          </Link>

          {!loading && !user && (
            <button onClick={login} className="block w-full nav-primary-btn">
              ⚡ Login with Google
            </button>
          )}

          {!loading && user && (
            <button onClick={logout} className="block w-full nav-danger-btn">
              Logout
            </button>
          )}
        </div>
      )}
    </header>
  );
}
