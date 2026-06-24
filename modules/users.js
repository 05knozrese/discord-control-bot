const settings = {};

function commands(client, m) {
  const id = m.author.id;

  if (!settings[id]) {
    settings[id] = { ping: true };
  }

  if (m.content === "!ping on") {
    settings[id].ping = true;
    return m.reply("🔔 Ping ON");
  }

  if (m.content === "!ping off") {
    settings[id].ping = false;
    return m.reply("🔕 Ping OFF");
  }

  if (m.content === "!me") {
    return m.reply(`Ping mode: ${settings[id].ping}`);
  }
}

module.exports = { commands };
