const { Client, GatewayIntentBits, Partials } = require("discord.js");

const panel = require("./modules/panel");
const nfl = require("./modules/nfl");
const youtube = require("./modules/youtube");
const users = require("./modules/users");
const reminders = require("./modules/reminders");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("Missing TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once("ready", () => {
  console.log(`✅ V7 ONLINE: ${client.user.tag}`);
});

client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  panel.commands(client, m);
  nfl.commands(client, m);
  youtube.commands(client, m);
  users.commands(client, m);
  reminders.commands(client, m);
});

nfl.init(client);
youtube.init(client);
reminders.init(client);

client.login(TOKEN);
