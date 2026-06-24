const https = require("https");

// ---------------- FETCH FEED ----------------
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

// ---------------- MODULE HANDLER ----------------
async function handleInteraction(i, db) {

  if (i.customId !== "youtube") return false;

  const rows = await new Promise(res =>
    db.all("SELECT * FROM youtube", (e, r) => res(r || []))
  );

  const list = rows.length
    ? rows.map(r =>
        `📺 **${r.channel_name}**
https://youtube.com/channel/${r.channel_id}`
      ).join("\n\n")
    : "No channels tracked";

  await i.editReply(
`📺 **YOUTUBE DASHBOARD**

${list}

━━━━━━━━━━━━━━`
  );

  return true;
}

module.exports = { handleInteraction };
