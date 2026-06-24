const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

// USERS
db.run(`
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  ping INTEGER DEFAULT 1
)
`);

// YOUTUBE
db.run(`
CREATE TABLE IF NOT EXISTS youtube (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT,
  channel_name TEXT,
  notify_channel TEXT,
  ping INTEGER DEFAULT 1
)
`);

// NFL TEAM
db.run(`
CREATE TABLE IF NOT EXISTS nfl (
  user_id TEXT PRIMARY KEY,
  team TEXT
)
`);

module.exports = db;
