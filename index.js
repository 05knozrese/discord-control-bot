const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder 
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers
  ]
});

// ---------------- DATABASE ----------------
const db = new sqlite3.Database("./bot.db");

db.run(`
CREATE TABLE IF NOT EXISTS youtube (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  name TEXT,
  url TEXT,
  last_video TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  game TEXT,
  minutes INTEGER,
  date TEXT
)
`);

// ---------------- GAME TRACKING ----------------
let sessions = {};

client.on("presenceUpdate", (oldP, newP) => {
  if (!newP?.userId) return;

  const activity = newP.activities?.find(a => a.type === 0);
  const userId = newP.userId;

  if (activity) {
    if (!sessions[userId]) {
      sessions[userId] = {
        game: activity.name,
        start: Date.now()
      };
    }
  } else if (sessions[userId]) {
    const s = sessions[userId];
    delete sessions[userId];

    const mins = Math.floor((Date.now() - s.start) / 60000);
    const date = new Date().toISOString().split("T")[0];

    db.run(
      "INSERT INTO games (user_id, game, minutes, date) VALUES (?, ?, ?, ?)",
      [userId, s.game, mins, date]
    );
  }
});

// ---------------- PANEL ----------------
client.on("messageCreate", async (msg) => {
  if (msg.content === "/panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎛 Control Panel V2")
      .setDescription("Manage your bot here")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("stats")
        .setLabel("📊 Weekly Stats")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("leaderboard")
        .setLabel("🏆 Leaderboard")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("youtube")
        .setLabel("📺 YouTube Help")
        .setStyle(ButtonStyle.Secondary)
    );

    msg.reply({ embeds: [embed], components: [row] });
  }

  // ADD YOUTUBE CHANNEL
  if (msg.content.startsWith("/addyt")) {
    const url = msg.content.split(" ")[1];
    const name = "channel-" + Date.now();

    db.run(
      "INSERT INTO youtube (guild_id, name, url, last_video) VALUES (?, ?, ?, '')",
      [msg.guild.id, name, url]
    );

    msg.reply("📺 YouTube channel added!");
  }

  // WEEKLY STATS
  if (msg.content === "/weekly") {
    db.all(
      `SELECT game, SUM(minutes) as total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY game
       ORDER BY total DESC`,
      [],
      (err, rows) => {
        if (!rows.length) return msg.reply("No data yet.");

        let text = "📊 Weekly Stats\n\n";
        rows.forEach(r => {
          text += `🎮 ${r.game}: ${r.total} min\n`;
        });

        msg.reply(text);
      }
    );
  }

  // LEADERBOARD
  if (msg.content === "/leaderboard") {
    db.all(
      `SELECT user_id, SUM(minutes) as total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY user_id
       ORDER BY total DESC
       LIMIT 10`,
      [],
      (err, rows) => {
        let text = "🏆 Leaderboard\n\n";

        rows.forEach((r, i) => {
          text += `${i + 1}. <@${r.user_id}> - ${r.total} min\n`;
        });

        msg.reply(text);
      }
    );
  }
});

// ---------------- BUTTONS ----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "stats") {
    db.all(
      `SELECT game, SUM(minutes) as total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY game
       ORDER BY total DESC`,
      [],
      (err, rows) => {
        let text = "📊 Weekly Stats\n\n";
        if (!rows.length) text = "No data yet.";

        rows.forEach(r => {
          text += `🎮 ${r.game}: ${r.total} min\n`;
        });

        interaction.reply({ content: text, ephemeral: true });
      }
    );
  }

  if (interaction.customId === "leaderboard") {
    db.all(
      `SELECT user_id, SUM(minutes) as total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY user_id
       ORDER BY total DESC
       LIMIT 10`,
      [],
      (err, rows) => {
        let text = "🏆 Leaderboard\n\n";

        rows.forEach((r, i) => {
          text += `${i + 1}. <@${r.user_id}> - ${r.total} min\n`;
        });

        interaction.reply({ content: text, ephemeral: true });
      }
    );
  }

  if (interaction.customId === "youtube") {
    interaction.reply({
      content:
`📺 YouTube Setup:

Use:
• /addyt <rss_url>
• /weekly
• /leaderboard

RSS format:
https://www.youtube.com/feeds/videos.xml?channel_id=ID`,
      ephemeral: true
    });
  }
});

// ---------------- START ----------------
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
