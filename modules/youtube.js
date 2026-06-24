const fs = require("fs");

let client;

let channels = [];      // {id, name, notify}
let lastVideos = {};    // {channelId: videoId}

// load saved data
if (fs.existsSync("youtube.json")) {
  const data = JSON.parse(fs.readFileSync("youtube.json"));
  channels = data.channels || [];
  lastVideos = data.lastVideos || {};
}

function save() {
  fs.writeFileSync(
    "youtube.json",
    JSON.stringify({ channels, lastVideos }, null, 2)
  );
}

function init(c) {
  client = c;

  setInterval(async () => {
    for (const ch of channels) {
      try {
        const res = await fetch(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`
        );

        const text = await res.text();

        const vids = [...text.matchAll(/<yt:videoId>(.*?)<\/yt:videoId>/g)]
          .map(v => v[1]);

        if (!vids.length) continue;

        const latest = vids[0];

        // 🔥 STOP DUPLICATES
        if (lastVideos[ch.id] === latest) continue;

        lastVideos[ch.id] = latest;
        save();

        const channel = await client.channels.fetch(ch.notify);

        channel.send(
          `📺 **${ch.name} uploaded a new video**\n` +
          `https://youtube.com/watch?v=${latest}`
        );

      } catch (e) {
        console.log("YouTube error:", e.message);
      }
    }
  }, 60000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  // ADD CHANNEL (NAME FIX INCLUDED)
  if (args[0] === "!ytadd") {
    const id = args[1];

    fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
      .then(r => r.text())
      .then(text => {
        const name = text.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown Channel";

        channels.push({
          id,
          name,
          notify: m.channel.id
        });

        save();

        m.reply(`📺 Added: **${name}**`);
      })
      .catch(() => m.reply("❌ Failed to add channel"));
  }

  // LIST CHANNELS (WITH LINK)
  if (args[0] === "!ytlist") {
    return m.reply(
      channels.length
        ? channels
            .map(c =>
              `📺 **${c.name}**\nhttps://youtube.com/channel/${c.id}`
            )
            .join("\n\n")
        : "No channels added"
    );
  }
}

module.exports = { init, commands };
