let client;
let channels = [];
let last = {};

function init(c) {
  client = c;

  setInterval(async () => {
    for (const id of channels) {
      try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
        const text = await res.text();

        const match = text.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
        if (!match) continue;

        const video = match[1];

        if (last[id] === video) continue;
        last[id] = video;

        const ch = await client.channels.fetch(channels[0]);
        ch.send(`📺 NEW VIDEO: https://youtube.com/watch?v=${video}`);
      } catch {}
    }
  }, 60000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!ytadd") {
    channels.push(args[1]);
    return m.reply("📺 Added channel");
  }

  if (args[0] === "!ytlist") {
    return m.reply(channels.join("\n") || "None");
  }
}

module.exports = { init, commands };
