const db = require("./db");

function init(client) {
  setInterval(async () => {
    db.all("SELECT * FROM youtube", async (err, rows) => {
      if (!rows) return;

      for (const r of rows) {
        try {
          const res = await fetch(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${r.channel_id}`
          );

          const text = await res.text();

          const videoId =
            text.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];

          if (!videoId) continue;

          // STOP DUPLICATES
          if (r.last_video === videoId) continue;

          db.run(
            "UPDATE youtube SET last_video=? WHERE id=?",
            [videoId, r.id]
          );

          const channel = await client.channels.fetch(r.notify_channel);

          if (!channel) return;

          channel.send(
            `📺 **${r.channel_name}** just uploaded:\nhttps://youtube.com/watch?v=${videoId}`
          );

        } catch (e) {
          console.log("YouTube error:", e.message);
        }
      }
    });
  }, 60000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  // ADD CHANNEL
  if (args[0] === "!yt" && args[1] === "add") {
    const id = args[2];
    if (!id) return m.reply("Usage: !yt add CHANNEL_ID");

    fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`
    )
      .then(r => r.text())
      .then(text => {
        const name =
          text.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown";

        const latest =
          text.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";

        db.run(
          `INSERT OR IGNORE INTO youtube
          (channel_id,channel_name,notify_channel,last_video)
          VALUES (?,?,?,?)`,
          [id, name, m.channel.id, latest]
        );

        m.reply(`✅ Added **${name}**`);
      });
  }

  // LIST CHANNELS
  if (args[0] === "!yt" && args[1] === "list") {
    db.all("SELECT * FROM youtube", (err, rows) => {
      if (!rows?.length) return m.reply("No channels added");

      m.reply(
        rows
          .map(
            (r, i) =>
              `${i + 1}. ${r.channel_name}
https://youtube.com/channel/${r.channel_id}`
          )
          .join("\n\n")
      );
    });
  }

  // REMOVE CHANNEL
  if (args[0] === "!yt" && args[1] === "remove") {
    const id = args[2];
    if (!id) return m.reply("Usage: !yt remove CHANNEL_ID");

    db.run("DELETE FROM youtube WHERE channel_id=?", [id]);

    m.reply("🗑 Removed channel");
  }
}

module.exports = { init, commands };
