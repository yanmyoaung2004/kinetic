// @ts-expect-error: No type definitions for 'better-sqlite3'
import Database from "better-sqlite3";

const db = new Database("agent_processes.db");

// Setup the table
db.exec(`
  CREATE TABLE IF NOT EXISTS processes (
    pid INTEGER PRIMARY KEY,
    command TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export const Registry = {
  save: (pid: number, cmd: string) => {
    db.prepare("INSERT INTO processes (pid, command) VALUES (?, ?)").run(
      pid,
      cmd,
    );
  },
  remove: (pid: number) => {
    db.prepare("DELETE FROM processes WHERE pid = ?").run(pid);
  },
  list: () => {
    return db.prepare("SELECT * FROM processes").all();
  },
};
