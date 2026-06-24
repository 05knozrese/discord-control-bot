const db = require("./db");

function init() {}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!ping" && args[1] === "on") {
    db.run("INSERT OR REPLACE INTO users VALUES (?,1)", [m.author.id]);
    return m.reply("🔔 Ping ON");
  }

  if (args[0] === "!ping" && args[1] === "off") {
    db.run("INSERT OR REPLACE INTO users VALUES (?,0)", [m.author.id]);
    return m.reply("🔕 Ping OFF");
  }

  if (args[0] === "!me") {
    db.get("SELECT ping FROM users WHERE user_id=?", [m.author.id], (err, row) => {
      m.reply(`Ping: ${row?.ping ? "ON" : "OFF"}`);
    });
  }
}

module.exports = { init, commands };
