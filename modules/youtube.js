const https = require("https");
const db = require("./db");

// ---------------- SAFE FEED FETCH ----------------
function getFeed(channelId) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
        (res) => {
          let data = "";

          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      )
      .on("error", reject);
  });
}

// ---------------- INIT (AUTO CHECK UPLOADS) ----------------
function init(client) {
  setInterval(async () => {
    db.all("SELECT * FROM youtube", async (err, rows) => {
      if (!rows) return;

      for (const r of rows) {
        try {
          const text = await getFeed(r.channel_id);

          const videoId =
            text.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];

          if (!videoId) continue;

          // STOP DUPLICATES
          if (r.last_video === videoId) continue;

          db.run(
            "UPDATE youtube SET last_video=? WHERE id=?",
            [videoId, r.id]
          );

          const channel = await client.channels.fetch(r.notify_channel).catch(() => null);
          if (!channel) continue;

          channel.send(
            `📺 **${r.channel_name}** uploaded a new video:\nhttps://youtube.com/watch?v=${videoId}`
          );

        } catch (e) {
          console.log("YouTube loop error:", e.message);
        }
      }
    });
  }, 60000);
}

// ---------------- COMMANDS ----------------
function commands(client, m) {
  const args = m.content.split(" ");

  // ---------------- ADD CHANNEL ----------------
  if (args[0] === "!yt" && args[1] === "add") {
    const id = args[2];

    if (!id) {
      return m.reply("❌ Usage: !yt add CHANNEL_ID");
    }

    getFeed(id)
      .then((text) => {
        const name =
          text.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown Channel";

        const latest =
          text.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";

        db.run(
          `INSERT OR REPLACE INTO youtube
          (channel_id, channel_name, notify_channel, last_video)
          VALUES (?,?,?,?)`,
          [id, name, m.channel.id, latest]
        );

        m.reply(`✅ Added YouTube channel: **${name}**`);
      })
      .catch((err) => {
        console.log("YT ADD ERROR:", err.message);
        m.reply("❌ Failed to fetch channel. Check ID.");
      });
  }

  // ---------------- LIST CHANNELS ----------------
  if (args[0] === "!yt" && args[1] === "list") {
    db.all("SELECT * FROM youtube", (err, rows) => {
      if (!rows || rows.length === 0) {
        return m.reply("📺 No YouTube channels added.");
      }

      m.reply(
        rows
          .map(
            (r, i) =>
              `**${i + 1}. ${r.channel_name}**\nhttps://youtube.com/channel/${r.channel_id}`
          )
          .join("\n\n")
      );
    });
  }

  // ---------------- REMOVE CHANNEL ----------------
  if (args[0] === "!yt" && args[1] === "remove") {
    const id = args[2];

    if (!id) {
      return m.reply("❌ Usage: !yt remove CHANNEL_ID");
    }

    db.run("DELETE FROM youtube WHERE channel_id=?", [id]);

    m.reply("🗑 Removed YouTube channel");
  }
}

module.exports = { init, commands };
