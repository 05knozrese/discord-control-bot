const https = require("https");

// ---------------- FEED ----------------
function getFeed(id) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
      res => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => resolve(d));
      }
    ).on("error", reject);
  });
}

// ---------------- HANDLE ----------------
async function handle(i, db) {

  // OPEN DASHBOARD
  if (i.customId === "youtube") {

    const rows = await new Promise(res =>
      db.all("SELECT * FROM youtube", (e, r) => res(r || []))
    );

    const list = rows.length
      ? rows.map(r =>
          `📺 ${r.channel_name}\n${r.channel_id}`
        ).join("\n\n")
      : "No channels";

    return i.editReply({
      content: `📺 YOUTUBE DASHBOARD\n\n${list}`,
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Add", custom_id: "yt_add" },
            { type: 2, style: 4, label: "Remove", custom_id: "yt_remove" },
            { type: 2, style: 1, label: "Refresh", custom_id: "yt_refresh" }
          ]
        }
      ]
    });
  }

  // ADD
  if (i.customId === "yt_add") {
    await i.followUp({
      content: "Send CHANNEL ID now",
      ephemeral: true
    });

    const collected = await i.channel.awaitMessages({
      filter: m => m.author.id === i.user.id,
      max: 1,
      time: 30000
    }).catch(() => null);

    if (!collected) return true;

    const id = collected.first().content;

    const feed = await getFeed(id);

    const name =
      feed.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown";

    const video =
      feed.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";

    db.run(
      `INSERT OR REPLACE INTO youtube (channel_id, channel_name, notify_channel, last_video)
       VALUES (?,?,?,?)`,
      [id, name, i.channel.id, video]
    );

    await i.followUp(`✅ Added ${name}`);
    return true;
  }

  // REMOVE
  if (i.customId === "yt_remove") {

    const rows = await new Promise(res =>
      db.all("SELECT * FROM youtube", (e, r) => res(r || []))
    );

    if (!rows.length) {
      await i.followUp("No channels");
      return true;
    }

    const id = rows[0].channel_id;

    db.run("DELETE FROM youtube WHERE channel_id=?", [id]);

    await i.followUp("🗑 Removed first channel (test safe)");

    return true;
  }

  return false;
}

module.exports = { handle };
