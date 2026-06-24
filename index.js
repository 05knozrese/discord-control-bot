const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// ---------------- DATABASE ----------------
const db = new sqlite3.Database("./bot.db");

db.run(`CREATE TABLE IF NOT EXISTS games (
  user_id TEXT,
  game TEXT,
  minutes INTEGER,
  date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS youtube (
  guild_id TEXT,
  channel TEXT,
  notify_mode TEXT DEFAULT 'ping'
)`);

db.run(`CREATE TABLE IF NOT EXISTS reminders (
  user_id TEXT,
  message TEXT,
  time INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT,
  youtube_mode TEXT DEFAULT 'ping',
  nfl_mode TEXT DEFAULT 'ping'
)`);

// ---------------- GAME TRACKING ----------------
let sessions = {};

client.on("presenceUpdate", (oldP, newP) => {
  if (!newP?.userId) return;

  const activity = newP.activities?.find(a => a.type === 0);
  const userId = newP.userId;

  if (activity) {
    if (!sessions[userId] || sessions[userId].game !== activity.name) {
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
      "INSERT INTO games VALUES (?, ?, ?, ?)",
      [userId, s.game, mins, date]
    );
  }
});

// ---------------- SLASH COMMANDS ----------------
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Open control panel"),

  new SlashCommandBuilder().setName("stats").setDescription("Weekly stats"),

  new SlashCommandBuilder().setName("leaderboard").setDescription("Top players"),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View profile")
    .addUserOption(o => o.setName("user")),

  new SlashCommandBuilder()
    .setName("ytadd")
    .setDescription("Add YouTube channel")
    .addStringOption(o =>
      o.setName("channel").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ytlist")
    .setDescription("List YouTube channels"),

  new SlashCommandBuilder()
    .setName("remindme")
    .setDescription("Set reminder")
    .addStringOption(o => o.setName("time").setRequired(true))
    .addStringOption(o => o.setName("message").setRequired(true)),

  new SlashCommandBuilder()
    .setName("notify")
    .setDescription("Set notification mode (ping/silent/off)")
];

// ---------------- REGISTER COMMANDS ----------------
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function register() {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
}

// ---------------- PANEL ----------------
function panelEmbed() {
  return new EmbedBuilder()
    .setTitle("🎛 CONTROL PANEL")
    .setDescription(`
🎮 Gaming
📺 YouTube
🏈 NFL
🔔 Notifications
⏰ Reminders
📊 Stats
🏆 Leaderboard
👤 Profile
`)
    .setColor("Blue");
}

// ---------------- COMMANDS ----------------
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;

  if (cmd === "panel") {
    return i.reply({ embeds: [panelEmbed()] });
  }

  if (cmd === "stats") {
    db.all(
      `SELECT game, SUM(minutes) total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY game
       ORDER BY total DESC`,
      [],
      (e, r) => {
        i.reply(r.map(x => `🎮 ${x.game}: ${x.total}m`).join("\n") || "No data");
      }
    );
  }

  if (cmd === "leaderboard") {
    db.all(
      `SELECT user_id, SUM(minutes) total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY user_id
       ORDER BY total DESC
       LIMIT 10`,
      [],
      (e, r) => {
        i.reply(r.map((x, idx) => `${idx+1}. <@${x.user_id}> - ${x.total}m`).join("\n"));
      }
    );
  }

  if (cmd === "profile") {
    const user = i.options.getUser("user") || i.user;

    db.get(
      `SELECT SUM(minutes) total FROM games WHERE user_id = ?`,
      [user.id],
      (e, r) => {
        i.reply(`👤 ${user.username}\n🎮 Total: ${r?.total || 0} min`);
      }
    );
  }

  if (cmd === "ytadd") {
    const ch = i.options.getString("channel");

    db.run(
      "INSERT INTO youtube VALUES (?, ?, 'ping')",
      [i.guild.id, ch]
    );

    i.reply("📺 Added YouTube channel");
  }

  if (cmd === "ytlist") {
    db.all(
      "SELECT channel FROM youtube WHERE guild_id = ?",
      [i.guild.id],
      (e, r) => {
        if (!r.length) return i.reply("No channels");

        i.reply(
          r.map(x =>
            x.channel.startsWith("http")
              ? `📺 ${x.channel}`
              : `📺 https://youtube.com/@${x.channel}`
          ).join("\n")
        );
      }
    );
  }

  if (cmd === "remindme") {
    const time = i.options.getString("time");
    const msg = i.options.getString("message");

    const ms = parseInt(time) * 60000;

    db.run(
      "INSERT INTO reminders VALUES (?, ?, ?)",
      [i.user.id, msg, Date.now() + ms]
    );

    i.reply("⏰ Reminder set!");
  }

  if (cmd === "notify") {
    const mode = i.options.getString("mode");

    db.run(
      "INSERT INTO settings VALUES (?, ?, ?)",
      [i.user.id, mode, mode]
    );

    i.reply(`🔔 Notifications set to ${mode}`);
  }
});

// ---------------- REMINDERS LOOP ----------------
setInterval(() => {
  db.all("SELECT * FROM reminders", [], (e, rows) => {
    rows.forEach(r => {
      if (Date.now() >= r.time) {
        client.users.fetch(r.user_id).then(u => {
          u.send(`⏰ Reminder: ${r.message}`);
        });

        db.run("DELETE FROM reminders WHERE user_id = ? AND time = ?", [
          r.user_id,
          r.time
        ]);
      }
    });
  });
}, 60000);

// ---------------- START ----------------
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await register();
});

client.login(TOKEN);
