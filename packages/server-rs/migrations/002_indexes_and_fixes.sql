-- 002: Add missing indexes, fix FKs, fix column types

-- Sessions: index for lookup + cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Email tokens: index for cleanup
CREATE INDEX IF NOT EXISTS idx_email_tokens_expires_at ON email_tokens(expires_at);

-- Game members: unique constraint + user index
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_members_game_user ON game_members(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_game_members_user_id ON game_members(user_id);

-- Files: composite index for path lookups
CREATE INDEX IF NOT EXISTS idx_files_game_parent_name ON files(game_id, parent_id, name);
CREATE INDEX IF NOT EXISTS idx_files_game_id ON files(game_id);

-- Saves: index for user lookups
CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id);
CREATE INDEX IF NOT EXISTS idx_saves_game_user ON saves(game_id, user_id);

-- Fix: sessions FK should cascade on user delete
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Fix: game_members FKs should cascade
ALTER TABLE game_members DROP CONSTRAINT IF EXISTS game_members_game_id_fkey;
ALTER TABLE game_members ADD CONSTRAINT game_members_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE game_members DROP CONSTRAINT IF EXISTS game_members_user_id_fkey;
ALTER TABLE game_members ADD CONSTRAINT game_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Fix: files.size should be BIGINT (convert existing text → bigint, nulls stay null)
ALTER TABLE files ALTER COLUMN size TYPE BIGINT USING NULLIF(size, '')::BIGINT;
