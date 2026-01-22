"use client";

import { formatLastSeen } from "./lastSeen";


export default function FollowerCard({
  profile,
  onAction,
  actionTitle,
  actionDisabled,
  onVisit,
}) {
  return (
    <div className="group bg-gradient-to-br from-shotzi-ink/80 to-shotzi-ink/60 border border-shotzi-silver/20 rounded-2xl p-5 hover:border-shotzi-silver/40 transition-all duration-300 hover:shadow-lg hover:shadow-shotzi-wine/20 flex flex-col h-full">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        {/* Avatar */}
        <div
          className="relative cursor-pointer"
          onClick={onVisit}
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-shotzi-wine/40 to-shotzi-mocha/40 flex items-center justify-center flex-shrink-0 border border-shotzi-silver/20 group-hover:border-shotzi-silver/40 transition-all duration-200 overflow-hidden">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name || profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl">📷</span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-shotzi-wine/60 rounded-full border 2 border-shotzi-ink"></div>
        </div>

        {/* Action Button (Remove / Unfollow) - visible on hover if provided */}
        {onAction ? (
          <button
            onClick={onAction}
            disabled={actionDisabled}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 text-shotzi-silver/60 hover:text-red-400 hover:bg-red-900/20 rounded-lg active:scale-95 disabled:opacity-50"
            title={actionTitle}
          >
            {actionDisabled ? "..." : "✕"}
          </button>
        ) : null}
      </div>

      {/* Profile Info */}
      <div 
        className="mb-4 cursor-pointer flex-1"
        onClick={onVisit}
      >
        <h3 className="font-semibold text-shotzi-cream text-lg truncate group-hover:text-shotzi-silver transition-colors">
          {profile.display_name || profile.username || "User"}
        </h3>
        <p className="text-sm text-shotzi-silver/80 truncate">
          @{profile.username || profile.id?.slice(0, 8)}
        </p>
        {profile.last_active && (
          (() => {
            const s = formatLastSeen(profile.last_active);
            if (!s) return null;
            return (
              <p className="text-xs mt-1">
                <span className={`${s.type === 'online' ? 'text-green-400' : 'text-shotzi-silver/70'}`}>{s.text}</span>
              </p>
            );
          })()
        )}
        {profile.bio && (
          <p className="text-xs text-shotzi-silver/70 mt-2 line-clamp-2">
            {profile.bio}
          </p>
        )}
      </div>

      {/* Action Button (Visit Profile) */}
      <button
        onClick={onVisit}
        className="w-full px-4 py-2.5 bg-shotzi-wine/20 hover:bg-shotzi-wine/30 border border-shotzi-wine/30 rounded-lg text-shotzi-cream text-sm font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
      >
        <span>Visit Profile</span>
        <span>→</span>
      </button>
    </div>
  );
}
