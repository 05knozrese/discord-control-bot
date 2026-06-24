const https = require("https");
const db = require("./db");

// ---------------- SAFE RSS FETCH ----------------
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

// ---------------- INIT AUTO UPDATER ----------------
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

          if (r.last_video === videoId) continue;

          db.run(
            "UPDATE youtube SET last_video=? WHERE id=?",
            [videoId, r.id]
          );

          const channel = await client.channels
            .fetch(r.notify_channel)
            .catch(() => null);

          if (!channel) continue;

          channel.send(
            `📺 **${r.channel_name}** uploaded:\nhttps://youtube.com/watch?v=${videoId}`
          );

        } catch (e) {
          console.log("YouTube error:", e.message);
        }
      }
    });
  }, 60000);
}

// ---------------- PANEL VIEW (USED BY INDEX) ----------------
function dashboardEmbed(rows) {
  const list = rows?.length
    ? rows.map(
        (r, i) =>
          `**${i + 1}. ${r.channel_name}**
📺 https://youtube.com/channel/${r.channel_id}`
      ).join("\n\n")
    : "No YouTube channels added";

  return {
    content:
`📺 **YOUTUBE DASHBOARD**

${list}

━━━━━━━━━━━━━━
Manage your tracked channels below`,
  };
}

// ---------------- INTERACTION HANDLER ----------------
async function handleInteraction(i, db) {
  if (!i.isButton()) return;

  // OPEN DASHBOARD
  if (i.customId === "youtube") {
    db.all("SELECT * FROM youtube", (err, rows) => {
      i.editReply({
        ...dashboardEmbed(rows),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: "➕ Add Channel",
                custom_id: "yt_add"
              },
              {
                type: 2,
                style: 4,
                label: "🗑 Remove Channel",
                custom_id: "yt_remove"
              },
              {
                type: 2,
                style: 1,
                label: "🔄 Refresh",
                custom_id: "yt_refresh"
              }
            ]
          }
        ]
      });
    });
  }

  // REFRESH
  if (i.customId === "yt_refresh") {
    db.all("SELECT * FROM youtube", (err, rows) => {
      i.editReply({
        ...dashboardEmbed(rows),
        components: []
      });
    });
  }

  // ADD CHANNEL FLOW
  if (i.customId === "yt_add") {
    await i.editReply({
      content: "📺 Send YouTube CHANNEL ID (UCxxxx...)",
      components: []
    });

    const filter = (m) => m.author.id === i.user.id;

    const collected = await i.channel
      .awaitMessages({ filter, max: 1, time: 30000 })
      .catch(() => null);

    if (!collected) return;

    const id = collected.first().content;

    const text = await getFeed(id);

    let name =
      text.match(/<title>(.*?)<\/title>/)?.[1] ||
      text.match(/<name>(.*?)<\/name>/)?.[1] ||
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

    return i.followUp(`✅ Added **${name}**`);
  }

  // REMOVE CHANNEL FLOW
  if (i.customId === "yt_remove") {
    db.all("SELECT * FROM youtube", async (err, rows) => {
      if (!rows?.length) {
        return i.editReply("❌ No channels to remove");
      }

      const list = rows
        .map((r) => `${r.channel_name} (${r.channel_id})`)
        .join("\n");

      await i.editReply({
        content:
`🗑 Send CHANNEL ID to remove:

${list}`,
        components: []
      });

      const filter = (m) => m.author.id === i.user.id;

      const collected = await i.channel
        .awaitMessages({ filter, max: 1, time: 30000 })
        .catch(() => null);

      if (!collected) return;

      const id = collected.first().content;

      db.run("DELETE FROM youtube WHERE channel_id=?", [id]);

      return i.followUp("🗑 Removed channel");
    });
  }
}

module.exports = { init, handleInteraction };
