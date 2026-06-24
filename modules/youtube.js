let client;
let channels = [];
let mode = {}; // channelId -> "ping" or "silent"

function init(c) {
  client = c;

  setInterval(async () => {
    for (const id of channels) {
      try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
        const text = await res.text();

        const match = text.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
        if (!match) continue;

        const vid = match[1];

        const ch = await client.channels.fetch(channels[0]);

        if (mode[id] === "silent") {
          ch.send(`📺 New video uploaded`);
        } else {
          ch.send(`📺 **NEW VIDEO:** https://youtube.com/watch?v=${vid}`);
        }

      } catch {}
    }
  }, 60000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!ytadd") {
    channels.push(args[1]);
    return m.reply("📺 Channel added");
  }

  if (args[0] === "!ytmode") {
    mode[args[1]] = args[2]; // ping/silent
    return m.reply("📺 Mode set");
  }

  if (args[0] === "!ytlist") {
    return m.reply(channels.join("\n") || "None");
  }
}

module.exports = { init, commands };
