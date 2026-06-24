const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- DB ----------------
const db = new sqlite3.Database("./bot.db");

db.run(`CREATE TABLE IF NOT EXISTS games (
  user_id TEXT,
  game TEXT,
  minutes INTEGER,
  date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS youtube (
  guild_id TEXT,
  channel_id TEXT,
  last_video TEXT,
  mode TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS reminders (
  user_id TEXT,
  msg TEXT,
  time INTEGER
)`);

// ---------------- GAME TRACKING ----------------
let sessions = {};

client.on("presenceUpdate", (oldP, newP) => {
  if (!newP?.userId) return;

  const activity = newP.activities?.find(a => a.type === 0);
  const id = newP.userId;

  if (activity) {
    if (!sessions[id]) {
      sessions[id] = {
        game: activity.name,
        start: Date.now()
      };
    }
  } else if (sessions[id]) {
    const s = sessions[id];
    delete sessions[id];

    const mins = Math.floor((Date.now() - s.start) / 60000);
    const date = new Date().toISOString().split("T")[0];

    db.run("INSERT INTO games VALUES (?,?,?,?)", [
      id,
      s.game,
      mins,
      date
    ]);
  }
});

// ---------------- PANEL ----------------
function panel() {
  return new EmbedBuilder()
    .setTitle("🎛 CONTROL HUB")
    .setDescription(`
🎮 Gaming
📺 YouTube
🏈 NFL
🔔 Notifications
⏰ Reminders
📊 Stats
🏆 Leaderboard
`)
    .setColor("Blue");
}

// ---------------- YOUTUBE RSS ----------------
const fetch = global.fetch;

async function checkYouTube() {
  db.all("SELECT * FROM youtube", [], async (e, rows) => {
    for (const ch of rows) {
      try {
        const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channel_id}`;

        const res = await fetch(url);
        const text = await res.text();

        const match = text.match(/<entry>[\s\S]*?<yt:videoId>(.*?)<\/yt:videoId>[\s\S]*?<\/entry>/);

        if (!match) continue;

        const videoId = match[1];

        if (ch.last_video === videoId) continue;

        db.run(
          "UPDATE youtube SET last_video=? WHERE channel_id=?",
          [videoId, ch.channel_id]
        );

        const msg =
          ch.mode === "ping"
            ? `🔔 NEW VIDEO (PING)\nhttps://youtube.com/watch?v=${videoId}`
            : `📺 NEW VIDEO\nhttps://youtube.com/watch?v=${videoId}`;

        console.log(msg);
      } catch (err) {
        console.log("YouTube error", err);
      }
    }
  });
}

// run every 60 sec
setInterval(checkYouTube, 60000);

// ---------------- NFL (ESPN API NO KEY) ----------------
async function getNFL() {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  );

  const data = await res.json();

  return data.events.map(g => {
    const c = g.competitions[0];
    const t = c.competitors;

    return {
      name: g.name,
      status: c.status.type.state,
      clock: c.status.displayClock,
      team1: t[0].team.abbreviation,
      team2: t[1].team.abbreviation,
      score1: t[0].score,
      score2: t[1].score
    };
  });
}

// refresh every 30 sec
setInterval(async () => {
  const games = await getNFL();

  games.forEach(g => {
    console.log(
      `🏈 ${g.team1} ${g.score1} - ${g.score2} ${g.team2} | ${g.clock}`
    );
  });
}, 30000);

// ---------------- REMINDERS ----------------
setInterval(() => {
  db.all("SELECT * FROM reminders", [], (e, rows) => {
    rows.forEach(r => {
      if (Date.now() > r.time) {
        client.users.fetch(r.user_id).then(u => {
          u.send(`⏰ ${r.msg}`);
        });

        db.run(
          "DELETE FROM reminders WHERE user_id=? AND time=?",
          [r.user_id, r.time]
        );
      }
    });
  });
}, 30000);

// ---------------- PANEL COMMAND ----------------
client.on("messageCreate", (m) => {
  if (m.content === "/panel") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("gaming")
        .setLabel("🎮 Gaming")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("youtube")
        .setLabel("📺 YouTube")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("nfl")
        .setLabel("🏈 NFL")
        .setStyle(ButtonStyle.Primary)
    );

    m.reply({ embeds: [panel()], components: [row] });
  }
});

// ---------------- BUTTONS ----------------
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  if (i.customId === "gaming") {
    return i.reply({ content: "🎮 Gaming Hub (sessions tracked automatically)", ephemeral: true });
  }

  if (i.customId === "youtube") {
    db.all("SELECT * FROM youtube", [], (e, rows) => {
      if (!rows.length) return i.reply("No channels");

      i.reply({
        content: rows.map(r =>
          `📺 https://youtube.com/channel/${r.channel_id}`
        ).join("\n"),
        ephemeral: true
      });
    });
  }

  if (i.customId === "nfl") {
    getNFL().then(games => {
      const msg = games.slice(0, 3).map(g =>
        `🏈 ${g.team1} ${g.score1} - ${g.score2} ${g.team2} (${g.clock})`
      ).join("\n");

      i.reply({ content: msg, ephemeral: true });
    });
  }
});

// ---------------- LOGIN ----------------
client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
