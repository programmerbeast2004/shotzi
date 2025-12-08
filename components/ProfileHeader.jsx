"use client";

export default function ProfileHeader({ profile, isOwn, onEditClick }) {
  const bannerUrl = profile?.header_image_url;

  return (
    <section className="relative card overflow-hidden mb-4 mx-3 sm:mx-0">
      <div className="absolute -left-10 -top-8 w-40 decor-spot">
        <img src="/decor/flower-soft.svg" alt="" />
      </div>
      <div className="absolute -right-8 -bottom-8 w-36 decor-spot">
        <img src="/decor/leaves-soft.svg" alt="" />
      </div>

      <div className="h-24 sm:h-32 md:h-40 w-full relative">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt="Profile banner"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-shotzi-ink via-shotzi-wine/70 to-shotzi-mocha/70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-shotzi-ink/90 via-shotzi-ink/40 to-transparent" />
      </div>

      <div className="px-3 sm:px-6 pb-4 sm:pb-6 -mt-6 sm:-mt-8 flex items-end gap-2 sm:gap-3 relative">
        <div className="h-12 sm:h-16 w-12 sm:w-16 rounded-xl sm:rounded-2xl bg-shotzi-ink border border-shotzi-cream/60 flex items-center justify-center text-lg sm:text-2xl shadow-md shadow-shotzi-ink/90 flex-shrink-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || profile.username}
              className="h-full w-full object-cover rounded-xl sm:rounded-2xl"
            />
          ) : (
            <span>📷</span>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <h1 className="font-serif text-base sm:text-xl md:text-2xl tracking-tight text-shotzi-cream flex items-center gap-1 truncate">
            {profile?.display_name || profile?.username || "Shotzi user"}
          </h1>
          <p className="text-[10px] sm:text-[11px] text-shotzi-silver/80 truncate">
            @{profile?.username || profile?.id?.slice(0, 8)}
          </p>
        </div>
        {isOwn && (
          <button
            type="button"
            onClick={onEditClick}
            className="inline-flex items-center gap-1 sm:gap-2 rounded-full border border-shotzi-sand/60 bg-shotzi-ink px-2 sm:px-3 py-1.5 sm:py-2 text-[9px] sm:text-[11px] text-shotzi-cream hover:bg-shotzi-mocha/20 transition-all active:scale-95 min-h-[36px] sm:min-h-[40px] flex-shrink-0"
            title="Edit profile"
          >
            <span className="text-sm sm:text-base">🛠️</span>
            <span className="hidden xs:inline">Edit</span>
          </button>
        )}
      </div>

      {profile?.bio && (
        <div className="px-3 sm:px-6 pb-4 text-xs sm:text-sm text-shotzi-cream/90 whitespace-pre-line line-clamp-3">
          {profile.bio}
        </div>
      )}
    </section>
  );
}
