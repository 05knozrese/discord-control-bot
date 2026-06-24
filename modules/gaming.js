const db = require("../db");

// ---------------- START SESSION ----------------
function startSession(userId, game) {
  const startTime = Date.now();

  db.run(
    `INSERT INTO gaming (userId, game, startTime) VALUES (?,?,?)`,
    [userId, game, startTime]
  );
}

// ---------------- STOP SESSION ----------------
function stopSession(userId, cb) {
  const endTime = Date.now();

  db.get(
    `SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 1`,
    [userId],
    (err, row) => {
      if (!row) return cb("❌ No active session");

      const minutes = Math.floor((endTime - row.startTime) / 60000);

      db.run(
        `UPDATE gaming SET duration=? WHERE id=?`,
        [minutes, row.id]
      );

      cb(`⏹ Session saved: ${row.game} (${minutes} min)`);
    }
  );
}

// ---------------- GET STATS ----------------
function getStats(userId, cb) {
  db.all(
    `SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 10`,
    [userId],
    (err, rows) => {
      if (!rows || rows.length === 0) {
        return cb({
          total: 0,
          sessions: []
        });
      }

      let total = 0;

      const sessions = rows.map(r => {
        const d = r.duration || 0;
        total += d;

        return `🎮 ${r.game} — ${d} min`;
      });

      cb({
        total,
        sessions
      });
    }
  );
}

module.exports = {
  startSession,
  stopSession,
  getStats
};
