let db;

// this lets index.js pass the database in
function init(database) {
  db = database;
}

// START SESSION
function startSession(userId, game) {
  db.run(
    "INSERT INTO gaming (userId, game, startTime) VALUES (?,?,?)",
    [userId, game, Date.now()]
  );
}

// STOP SESSION
function stopSession(userId, cb) {
  db.get(
    "SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 1",
    [userId],
    (err, row) => {
      if (!row) return cb("❌ No session found");

      const mins = Math.floor((Date.now() - row.startTime) / 60000);

      db.run(
        "UPDATE gaming SET duration=? WHERE id=?",
        [mins, row.id]
      );

      cb(`⏹ Saved: ${row.game} (${mins} min)`);
    }
  );
}

// STATS
function getStats(userId, cb) {
  db.all(
    "SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 10",
    [userId],
    (err, rows) => {
      let total = 0;

      const sessions = (rows || []).map(r => {
        total += r.duration || 0;
        return `🎮 ${r.game} — ${r.duration || 0} min`;
      });

      cb({
        total,
        sessions
      });
    }
  );
}

module.exports = { init, startSession, stopSession, getStats };
