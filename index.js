const { Client, GatewayIntentBits } = require("discord.js");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ Missing TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- STATE ----------------
let nflChannel = null;
let ytChannels = [];

let lastNFL = "";
let lastVideos = {};

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`✅ V5 ONLINE: ${client.user.tag}`);
});

// ---------------- COMMANDS ----------------
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  const args = m.content.split(" ");

  // PANEL
  if (m.content === "!panel") {
    return m.reply(
      "🎛 V5 CONTROL PANEL\n\n" +
      "!nflon / !nfloff\n" +
      "!ytadd <channelId>\n" +
      "!ytdel <channelId>\n" +
      "!ytlist\n" +
      "!nfl (test)\n"
    );
  }

  // NFL TOGGLE
  if (m.content === "!nflon") {
    nflChannel = m.channel.id;
    return m.reply("🏈 NFL updates ENABLED");
  }

  if (m.content === "!nfloff") {
    nflChannel = null;
    return m.reply("🏈 NFL updates DISABLED");
  }

  // NFL TEST
  if (m.content === "!nfl") {
    return m.reply(await getNFL());
  }

  // YOUTUBE ADD
  if (m.content.startsWith("!ytadd ")) {
    const id = args[1];
    if (!ytChannels.includes(id)) ytChannels.push(id);
    return m.reply("📺 YouTube channel added");
  }

  // YOUTUBE REMOVE
  if (m.content.startsWith("!ytdel ")) {
    const id = args[1];
    ytChannels = ytChannels.filter(c => c !== id);
    return m.reply("📺 YouTube channel removed");
  }

  // YOUTUBE LIST
  if (m.content === "!ytlist") {
    return m.reply(
      ytChannels.length
        ? ytChannels.join("\n")
        : "No YouTube channels added"
    );
  }
});

// ---------------- NFL API ----------------
async function getNFL() {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );

    const data = await res.json();

    const games = data.events.slice(0, 5);

    return games.map(g => {
      const c = g.competitions[0];
      const t = c.competitors;

      return `🏈 ${t[0].team.abbreviation} ${t[0].score} - ${t[1].score} ${t[1].team.abbreviation} | ${c.status.type.shortDetail}`;
    }).join("\n");

  } catch {
    return "❌ NFL API error";
  }
}

// ---------------- NFL AUTO ----------------
setInterval(async () => {
  if (!nflChannel) return;

  try {
    const msg = await getNFL();
    if (msg === lastNFL) return;
    lastNFL = msg;

    const ch = await client.channels.fetch(nflChannel);
    ch.send(msg);
  } catch {}
}, 30000);

// ---------------- YOUTUBE AUTO ----------------
async function checkYouTube() {
  for (const channelId of ytChannels) {
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

      const res = await fetch(url);
      const text = await res.text();

      const match = text.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      if (!match) continue;

      const videoId = match[1];

      if (lastVideos[channelId] === videoId) continue;

      lastVideos[channelId] = videoId;

      const ch = await client.channels.fetch(nflChannel || ytChannels[0]);
      ch.send(`📺 NEW VIDEO: https://youtube.com/watch?v=${videoId}`);

    } catch {}
  }
}

setInterval(checkYouTube, 60000);

// ---------------- LOGIN ----------------
client.login(TOKEN);
