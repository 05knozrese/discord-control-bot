const { Client, GatewayIntentBits } = require("discord.js");

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- STORAGE ----------------
let nflChannel = null;
let ytChannel = null;

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`✅ ONLINE: ${client.user.tag}`);
});

// ---------------- PANEL ----------------
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  // PANEL
  if (m.content === "!panel") {
    return m.reply(
      "🎛 CONTROL HUB V7.1\n\n" +
      "Commands:\n" +
      "!nflon → enable NFL updates\n" +
      "!yton → enable YouTube alerts\n" +
      "!nfl → test NFL\n"
    );
  }

  // SET NFL CHANNEL
  if (m.content === "!nflon") {
    nflChannel = m.channel.id;
    return m.reply("🏈 NFL updates ENABLED in this channel");
  }

  // SET YOUTUBE CHANNEL
  if (m.content === "!yton") {
    ytChannel = m.channel.id;
    return m.reply("📺 YouTube alerts ENABLED in this channel");
  }

  // TEST NFL
  if (m.content === "!nfl") {
    const data = await getNFL();
    return m.reply(data);
  }
});

// ---------------- NFL API ----------------
async function getNFL() {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );
    const json = await res.json();

    const game = json.events[0];
    const comp = game.competitions[0];
    const t = comp.competitors;

    return `🏈 ${t[0].team.abbreviation} ${t[0].score} - ${t[1].score} ${t[1].team.abbreviation}
⏱ ${comp.status.displayClock}`;
  } catch {
    return "NFL data unavailable";
  }
}

// ---------------- AUTO NFL UPDATES ----------------
setInterval(async () => {
  if (!nflChannel) return;

  const channel = await client.channels.fetch(nflChannel);
  const msg = await getNFL();

  channel.send(msg);
}, 30000);

// ---------------- YOUTUBE (RSS SIMPLE) ----------------
let lastVideo = null;

async function checkYT() {
  if (!ytChannel) return;

  const url = "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw";

  const res = await fetch(url);
  const text = await res.text();

  const match = text.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
  if (!match) return;

  if (lastVideo === match[1]) return;

  lastVideo = match[1];

  const channel = await client.channels.fetch(ytChannel);
  channel.send(`📺 NEW VIDEO: https://youtube.com/watch?v=${match[1]}`);
}

setInterval(checkYT, 60000);

// ---------------- LOGIN ----------------
client.login(TOKEN);
