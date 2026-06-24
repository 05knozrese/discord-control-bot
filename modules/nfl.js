let client;
let channel = null;

async function fetchNFL() {
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    const data = await res.json();

    return data.events.slice(0, 5).map(g => {
      const c = g.competitions[0];
      const t = c.competitors;

      return `🏈 ${t[0].team.abbreviation} ${t[0].score} - ${t[1].score} ${t[1].team.abbreviation}`;
    }).join("\n");
  } catch {
    return "NFL error";
  }
}

function init(c) {
  client = c;

  setInterval(async () => {
    if (!channel) return;

    try {
      const ch = await client.channels.fetch(channel);
      ch.send("📊 NFL LIVE\n" + await fetchNFL());
    } catch {}
  }, 30000);
}

function commands(client, m) {
  if (m.content === "!nfl on") {
    channel = m.channel.id;
    m.reply("🏈 NFL ON");
  }

  if (m.content === "!nfl off") {
    channel = null;
    m.reply("🏈 NFL OFF");
  }

  if (m.content === "!nfl") {
    fetchNFL().then(x => m.reply(x));
  }
}

module.exports = { init, commands };
