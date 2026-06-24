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
let ytChannel = null;

// NFL cache (avoid spam duplicates)
let lastNFL = "";

// YouTube cache per channel
let lastVideos = {};

// Notification toggles
let settings = {
  nfl: true,
  youtube: true
};

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`✅ V4 ONLINE: ${client.user.tag}`);
});

// ---------------- PANEL ----------------
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  if (m.content === "!panel") {
    return m.reply(
      "🎛 V4 CONTROL HUB\n\n" +
      "!nflon / !nfloff\n" +
      "!yton / !ytoff\n" +
      "!status → check system\n" +
      "!nfl → test NFL"
    );
  }

  // ---------------- TOGGLES ----------------
  if (m.content === "!nflon") {
    nflChannel = m.channel.id;
    settings.nfl = true;
    return m.reply("🏈 NFL ENABLED");
  }

  if (m.content === "!nfloff") {
    settings.nfl = false;
    return m.reply("🏈 NFL DISABLED");
  }

  if (m.content === "!yton") {
    ytChannel = m.channel.id;
    settings.youtube = true;
    return m.reply("📺 YouTube ENABLED");
  }

  if (m.content === "!ytoff") {
    settings.youtube = false;
    return m.reply("📺 YouTube DISABLED");
  }

  if (m.content === "!status") {
    return m.reply(
      `📊 STATUS\nNFL: ${settings.nfl}\nYT: ${settings.youtube}`
    );
  }

  if (m.content === "!nfl") {
    return m.reply(await getNFL());
  }
});

// ---------------- NFL (MULTI GAME) ----------------
async function getNFL() {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );

    const data = await res.json();

    return data.events.slice(0, 3).map(g => {
      const c = g.competitions[0];
      const t = c.competitors;

      return `🏈 ${t[0].team.abbreviation} ${t[0].score} - ${t[1].score} ${t[1].team.abbreviation} (${c.status.displayClock})`;
    }).join("\n");

  } catch {
    return "❌ NFL error";
  }
}

// ---------------- AUTO NFL ----------------
setInterval(async () => {
  if (!settings.nfl || !nflChannel) return;

  try {
    const msg = await getNFL();
    if (msg === lastNFL) return;
    lastNFL = msg;

    const channel = await client.channels.fetch(nflChannel);
    channel.send(msg);

  } catch {}
}, 30000);

// ---------------- YOUTUBE MULTI ----------------
async function checkYouTube() {
  if (!settings.youtube || !ytChannel) return;

  try {
    const url =
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw";

    const res = await fetch(url);
    const text = await res.text();

    const match = text.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    if (!match) return;

    const videoId = match[1];

    if (lastVideos[ytChannel] === videoId) return;

    lastVideos[ytChannel] = videoId;

    const channel = await client.channels.fetch(ytChannel);
    channel.send(`📺 NEW VIDEO: https://youtube.com/watch?v=${videoId}`);

  } catch {}
}

setInterval(checkYouTube, 60000);

// ---------------- LOGIN ----------------
client.login(TOKEN);
