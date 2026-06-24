let client;
let channels = [];

function init(c) {
  client = c;

  setInterval(async () => {
    for (const c of channels) {
      try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`);
        const text = await res.text();

        const vid = text.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
        if (!vid) continue;

        const ch = await client.channels.fetch(c.notify);

        ch.send(`📺 **${c.name}** posted:\nhttps://youtube.com/watch?v=${vid}`);
      } catch {}
    }
  }, 60000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!ytadd") {
    const id = args[1];

    fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
      .then(r => r.text())
      .then(text => {
        const name = text.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown";

        channels.push({
          id,
          name,
          notify: m.channel.id
        });

        m.reply(`📺 Added: ${name}`);
      })
      .catch(() => m.reply("❌ Failed"));
  }

  if (args[0] === "!ytlist") {
    return m.reply(
      channels.map(c => `📺 ${c.name}`).join("\n") || "None"
    );
  }
}

module.exports = { init, commands };
