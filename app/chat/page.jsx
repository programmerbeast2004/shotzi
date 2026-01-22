"use client";

import { useEffect, useState } from "react";
import ConversationsList from "../../components/ConversationsList";
import DirectMessages from "../../components/DirectMessages";
import UsersDirectory from "../../components/UsersDirectory";

export default function MessagesPage() {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [showUsers, setShowUsers] = useState(false);

  const handleSelectUser = (userId, username) => {
    setSelectedUserId(userId);
    setSelectedUsername(username);
    setShowUsers(false);
  };

  // track client viewport width to avoid SSR/CSR mismatch
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const update = () => setIsDesktop(window.innerWidth >= 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] bg-shotzi-ink">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:flex w-80 flex-shrink-0 flex-col gap-4">
        <div className="flex-1 min-h-0 border border-shotzi-sand/20 rounded-lg overflow-hidden">
          <ConversationsList
            selectedUserId={selectedUserId}
            onSelectUser={handleSelectUser}
          />
        </div>
        <div className="flex-1 min-h-0 border border-shotzi-sand/20 rounded-lg overflow-hidden">
          <UsersDirectory onSelectUser={handleSelectUser} />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-w-0 border border-shotzi-sand/20 rounded-lg overflow-hidden">
        {/* Mobile: Show conversations list or users directory if no user selected */}
        {!selectedUserId && (
          <div className="md:hidden h-full flex">
            {/* Tabs for mobile */}
            <div className="w-full">
              <div className="flex gap-2 p-4 border-b border-shotzi-sand/40">
                <button
                  onClick={() => setShowUsers(false)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${
                    !showUsers
                      ? "bg-shotzi-wine text-white"
                      : "bg-shotzi-sand/20 text-shotzi-silver"
                  }`}
                >
                  Messages
                </button>
                <button
                  onClick={() => setShowUsers(true)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${
                    showUsers
                      ? "bg-shotzi-wine text-white"
                      : "bg-shotzi-sand/20 text-shotzi-silver"
                  }`}
                >
                  Find Users
                </button>
              </div>
              {showUsers ? (
                <UsersDirectory onSelectUser={handleSelectUser} />
              ) : (
                <ConversationsList
                  selectedUserId={selectedUserId}
                  onSelectUser={handleSelectUser}
                />
              )}
            </div>
          </div>
        )}

        {/* Desktop or Mobile with selected user */}
        {selectedUserId && (
          <div className="h-full flex flex-col">
            {/* Back button for mobile */}
            <div className="md:hidden p-3 border-b border-shotzi-sand/40 flex items-center gap-2">
              <button
                onClick={() => setSelectedUserId(null)}
                className="text-shotzi-wine hover:text-shotzi-wine/80 transition"
              >
                ← Back
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <DirectMessages
                selectedUserId={selectedUserId}
                selectedUsername={selectedUsername}
              />
            </div>
          </div>
        )}

        {/* Desktop: Empty state when no user selected */}
        {!selectedUserId && isMounted && isDesktop && (
          <div className="h-full flex items-center justify-center text-shotzi-silver">
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
