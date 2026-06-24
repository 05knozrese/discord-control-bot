let client;
let channel = null;
let lastMessage = null;

async function fetchNFL() {
  const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  const data = await res.json();

  return data.events.slice(0, 5).map(g => {
    const c = g.competitions[0];
    const t = c.competitors;

    return `🏈 ${t[0].team.abbreviation} ${t[0].score} - ${t[1].score} ${t[1].team.abbreviation} | ${c.status.type.shortDetail}`;
  }).join("\n");
}

function init(c) {
  client = c;

  setInterval(async () => {
    if (!channel) return;

    try {
      const ch = await client.channels.fetch(channel);
      const msg = await fetchNFL();

      // prevent spam
      if (msg === lastMessage) return;
      lastMessage = msg;

      await ch.send("📊 **NFL LIVE UPDATE**\n" + msg);

    } catch {}
  }, 30000);
}

function commands(client, m) {
  if (m.content === "!nfl on") {
    channel = m.channel.id;
    m.reply("🏈 NFL LIVE DASHBOARD ON");
  }

  if (m.content === "!nfl off") {
    channel = null;
    m.reply("🏈 NFL OFF");
  }

  if (m.content === "!nfl") {
    fetchNFL().then(x => m.reply("📊 NFL:\n" + x));
  }
}

module.exports = { init, commands };
