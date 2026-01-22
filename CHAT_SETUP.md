# 💬 Chat Feature Setup

## Database Tables to Create in Supabase

Run these SQL queries in your Supabase console to set up the chat system:

### 1. Direct Messages Table
```sql
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read BOOLEAN DEFAULT FALSE
);

-- Create indexes for faster queries
CREATE INDEX idx_direct_messages_sender ON direct_messages(sender_id);
CREATE INDEX idx_direct_messages_recipient ON direct_messages(recipient_id);
CREATE INDEX idx_direct_messages_conversation ON direct_messages(sender_id, recipient_id);
```

### 2. Global Chat Messages Table
```sql
CREATE TABLE IF NOT EXISTS global_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for ordering
CREATE INDEX idx_global_messages_created_at ON global_messages(created_at DESC);
CREATE INDEX idx_global_messages_user_id ON global_messages(user_id);
```

### 3. Enable RLS (Row Level Security)

```sql
-- Direct Messages RLS
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own direct messages" ON direct_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert direct messages" ON direct_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own direct messages" ON direct_messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Global Messages RLS
ALTER TABLE global_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global messages" ON global_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Users can send global messages" ON global_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own global messages" ON global_messages
  FOR DELETE
  USING (auth.uid() = user_id);
```

## Implementation Summary

- **Direct Messages**: Private 1-on-1 conversations between users
- **Global Chat**: World-wide public chat room for all users
- **Real-time**: Uses Supabase Realtime for instant message updates
- **Text-only**: Only textual messages (no images/media initially)
