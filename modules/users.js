const fs = require("fs");

let users = {};

if (fs.existsSync("users.json")) {
  users = JSON.parse(fs.readFileSync("users.json"));
}

function save() {
  fs.writeFileSync("users.json", JSON.stringify(users));
}

function init() {}

function commands(client, m) {
  const id = m.author.id;

  if (!users[id]) {
    users[id] = { ping: true };
  }

  if (m.content === "!ping on") {
    users[id].ping = true;
    save();
    return m.reply("🔔 Ping ON");
  }

  if (m.content === "!ping off") {
    users[id].ping = false;
    save();
    return m.reply("🔕 Ping OFF");
  }

  if (m.content === "!me") {
    return m.reply(`Ping: ${users[id].ping}`);
  }
}

module.exports = { init, commands };
