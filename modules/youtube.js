const db = require("./db");

let lastVideos = {};

function init(client) {
  setInterval(async () => {
    db.all("SELECT * FROM youtube", async (err, rows) => {
      for (const r of rows) {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${r.channel_id}`);
        const text = await res.text();

        const vid = text.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
        if (!vid || lastVideos[r.channel_id] === vid) continue;

        lastVideos[r.channel_id] = vid;

        const ch = await client.channels.fetch(r.notify_channel);

        ch.send(
          `📺 **${r.channel_name}** uploaded:\nhttps://youtube.com/watch?v=${vid}`
        );
      }
    });
  }, 60000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!yt" && args[1] === "add") {
    const id = args[2];

    fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
      .then(r => r.text())
      .then(text => {
        const name = text.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown";

        db.run(
          "INSERT INTO youtube(channel_id,channel_name,notify_channel) VALUES (?,?,?)",
          [id, name, m.channel.id]
        );

        m.reply(`📺 Added ${name}`);
      });
  }

  if (args[0] === "!yt" && args[1] === "list") {
    db.all("SELECT * FROM youtube", (err, rows) => {
      m.reply(
        rows.map(r =>
          `📺 ${r.channel_name}\nhttps://youtube.com/channel/${r.channel_id}`
        ).join("\n\n") || "None"
      );
    });
  }

  if (args[0] === "!yt" && args[1] === "remove") {
    const id = args[2];

    db.run("DELETE FROM youtube WHERE channel_id=?", [id]);
    m.reply("🗑 Removed channel");
  }
}

module.exports = { init, commands };
