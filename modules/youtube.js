const https = require("https");

// ---------------- FETCH ----------------
function getFeed(channelId) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      res => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve(data));
      }
    ).on("error", reject);
  });
}

// ---------------- DASHBOARD HANDLER ----------------
async function handleInteraction(i, db) {

  // OPEN DASHBOARD
  if (i.customId === "youtube") {

    const rows = await new Promise(res =>
      db.all("SELECT * FROM youtube", (e, r) => res(r || []))
    );

    const list = rows.length
      ? rows.map(r =>
          `📺 **${r.channel_name}**
https://youtube.com/channel/${r.channel_id}`
        ).join("\n\n")
      : "No channels added";

    await i.editReply({
      content:
`📺 **YOUTUBE DASHBOARD**

${list}

━━━━━━━━━━━━━━`,
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "➕ Add", custom_id: "yt_add" },
            { type: 2, style: 4, label: "🗑 Remove", custom_id: "yt_remove" },
            { type: 2, style: 1, label: "🔄 Refresh", custom_id: "yt_refresh" }
          ]
        }
      ]
    });

    return true;
  }

  // REFRESH
  if (i.customId === "yt_refresh") {
    return true;
  }

  // ➕ ADD CHANNEL FLOW
  if (i.customId === "yt_add") {

    await i.editReply({
      content: "📺 Send YouTube CHANNEL ID (UCxxxx...)",
      components: []
    });

    const collected = await i.channel.awaitMessages({
      filter: m => m.author.id === i.user.id,
      max: 1,
      time: 30000
    }).catch(() => null);

    if (!collected) return true;

    const id = collected.first().content;

    const text = await getFeed(id);

    let name =
      text.match(/<title>(.*?)<\/title>/)?.[1] ||
      "Unknown Channel";

    name = name.replace(" - YouTube", "").trim();

    const video =
      text.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";

    db.run(
      `INSERT OR REPLACE INTO youtube
      (channel_id, channel_name, notify_channel, last_video)
      VALUES (?,?,?,?)`,
      [id, name, i.channel.id, video]
    );

    await i.followUp(`✅ Added **${name}**`);

    return true;
  }

  // 🗑 REMOVE CHANNEL FLOW
  if (i.customId === "yt_remove") {

    const rows = await new Promise(res =>
      db.all("SELECT * FROM youtube", (e, r) => res(r || []))
    );

    if (!rows.length) {
      await i.editReply("❌ No channels to remove");
      return true;
    }

    const list = rows.map(r => `${r.channel_name} (${r.channel_id})`).join("\n");

    await i.editReply({
      content:
`🗑 Send CHANNEL ID to remove:

${list}`,
      components: []
    });

    const collected = await i.channel.awaitMessages({
      filter: m => m.author.id === i.user.id,
      max: 1,
      time: 30000
    }).catch(() => null);

    if (!collected) return true;

    const id = collected.first().content;

    db.run("DELETE FROM youtube WHERE channel_id=?", [id]);

    await i.followUp("🗑 Removed channel");

    return true;
  }

  return false;
}

module.exports = { handleInteraction };
