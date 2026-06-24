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

// ---------------- HANDLER ----------------
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
      : "No channels added";

    await i.editReply({
      content: `📺 YOUTUBE DASHBOARD\n\n${list}`,
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Add", custom_id: "yt_add" },
            { type: 2, style: 4, label: "Remove All", custom_id: "yt_remove" },
            { type: 2, style: 1, label: "Refresh", custom_id: "yt_refresh" }
          ]
        }
      ]
    });

    return true;
  }

  // ---------------- ADD ----------------
  if (i.customId === "yt_add") {

    await i.followUp({ content: "Send Channel ID (UC...)", ephemeral: true });

    const msg = await i.channel.awaitMessages({
      filter: m => m.author.id === i.user.id,
      max: 1,
      time: 30000
    }).catch(() => null);

    if (!msg) return true;

    const id = msg.first().content;

    const feed = await getFeed(id);

    const name =
      feed.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown";

    const video =
      feed.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";

    db.run(
      `INSERT OR REPLACE INTO youtube
      (channel_id, channel_name, notify_channel, last_video)
      VALUES (?,?,?,?)`,
      [id, name, i.channel.id, video]
    );

    await i.followUp(`✅ Added ${name}`);

    return true;
  }

  // ---------------- REMOVE ALL (SAFE) ----------------
  if (i.customId === "yt_remove") {

    db.run("DELETE FROM youtube");

    await i.followUp("🗑 All channels removed");

    return true;
  }

  return false;
}

module.exports = { handle };
