// @ts-expect-error: No type definitions for 'better-sqlite3'
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const db = new Database("kinetic_vault.db");
sqliteVec.load(db);

// Initialize all three layers: Relational, Vector, and Keyword
db.exec(`
  -- 1. The Source of Truth
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    role TEXT CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Semantic Layer (Concepts)
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_messages USING vec0(
    embedding FLOAT[768]
  );

  -- 3. Keyword Layer (Exact words)
  CREATE VIRTUAL TABLE IF NOT EXISTS fts_messages USING fts5(
    content,
    content_id UNINDEXED
  );
`);

export default db;

// // @ts-expect-error: No type definitions for 'better-sqlite3'
// import Database from "better-sqlite3";
// import * as sqliteVec from "sqlite-vec";

// const db = new Database("kinetic_vault.db");
// sqliteVec.load(db);

// db.exec(`
//   -- 1. The Source of Truth
//   CREATE TABLE IF NOT EXISTS messages (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
//     content TEXT NOT NULL,
//     created_at INTEGER NOT NULL,  -- Unix timestamp for efficient queries
//     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP  -- Human-readable fallback
//   );

//   -- Index for cleanup operations (ORDER BY created_at DESC)
//   CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

//   -- 2. Semantic Layer (Concepts) with chunk metadata
//   CREATE VIRTUAL TABLE IF NOT EXISTS vec_messages USING vec0(
//     embedding FLOAT[768]
//   );

//   -- Metadata table for chunks (vec0 doesn't support extra columns)
//   CREATE TABLE IF NOT EXISTS vec_metadata (
//     rowid INTEGER PRIMARY KEY,  -- Must match vec_messages rowid
//     message_id INTEGER NOT NULL,  -- Links back to messages.id
//     chunk_index INTEGER DEFAULT 0,
//     chunk_total INTEGER DEFAULT 1,
//     FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
//   );

//   -- Index for chunk queries
//   CREATE INDEX IF NOT EXISTS idx_vec_metadata_message_id ON vec_metadata(message_id);

//   -- 3. Keyword Layer (Exact words)
//   CREATE VIRTUAL TABLE IF NOT EXISTS fts_messages USING fts5(
//     content,
//     content_id UNINDEXED
//   );

//   -- Trigger to auto-delete vec_messages when messages deleted
//   CREATE TRIGGER IF NOT EXISTS cleanup_vec_on_delete
//   AFTER DELETE ON messages
//   BEGIN
//     DELETE FROM vec_messages WHERE rowid IN (
//       SELECT rowid FROM vec_metadata WHERE message_id = OLD.id
//     );
//     DELETE FROM vec_metadata WHERE message_id = OLD.id;
//   END;

//   -- Trigger to auto-delete fts_messages when messages deleted
//   CREATE TRIGGER IF NOT EXISTS cleanup_fts_on_delete
//   AFTER DELETE ON messages
//   BEGIN
//     DELETE FROM fts_messages WHERE content_id = OLD.id;
//   END;
// `);

// // Enable WAL mode for better concurrent performance
// db.pragma("journal_mode = WAL");

// // Optimize for read-heavy workloads (memory system)
// db.pragma("synchronous = NORMAL");
// db.pragma("cache_size = -64000"); // 64MB cache

// // Foreign key enforcement
// db.pragma("foreign_keys = ON");

// export default db;
