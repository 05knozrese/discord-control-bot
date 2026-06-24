const https = require("https");

// ---------------- FEED ----------------
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

// ---------------- STATE MEMORY ----------------
const waiting = new Map();

// ---------------- MAIN HANDLER ----------------
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

${list}`,
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

  // ---------------- START ADD FLOW ----------------
  if (i.customId === "yt_add") {

    waiting.set(i.user.id, "add");

    await i.editReply({
      content: "📥 Send YouTube Channel ID (UCxxxx)",
      components: []
    });

    return true;
  }

  // ---------------- MESSAGE INPUT HANDLER ----------------
  if (waiting.get(i.user.id) === "add") {

    const id = i.message?.content || i.content;
    if (!id) return false;

    waiting.delete(i.user.id);

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

  return false;
}

module.exports = { handleInteraction };
