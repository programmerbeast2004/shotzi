"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function UsersDirectory({ onSelectUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data?.user ?? null);
    };
    getUser();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .neq("id", currentUser?.id)
          .order("username");

        if (error) throw error;
        setUsers(data || []);
        setLoading(false);
      } catch (error) {
        console.error("Error loading users:", error);
        setLoading(false);
      }
    };

    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleMessageClick = (userId, username) => {
    onSelectUser(userId, username);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-shotzi-sand/40 p-4 bg-shotzi-ink/95">
        <h3 className="text-lg font-serif text-shotzi-cream mb-3">
          👥 Find Users
        </h3>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-shotzi-sand/20 text-shotzi-cream placeholder-shotzi-silver/50 border border-shotzi-sand/40 focus:outline-none focus:border-shotzi-wine transition text-sm"
        />
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="p-4 text-center text-shotzi-silver text-sm">
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-shotzi-silver text-sm">
            {users.length === 0 ? "No users found" : "No matching users"}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="px-4 py-3 border-b border-shotzi-sand/20 hover:bg-shotzi-sand/10 transition flex items-center gap-3 justify-between"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-shotzi-sand/40 flex items-center justify-center text-xs text-shotzi-cream flex-shrink-0">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <p className="text-sm text-shotzi-cream truncate">
                  {user.username}
                </p>
              </div>
              <button
                onClick={() => handleMessageClick(user.id, user.username)}
                className="px-3 py-1 rounded-lg bg-shotzi-wine text-white text-xs font-medium hover:bg-shotzi-wine/90 transition flex-shrink-0"
              >
                Message
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
