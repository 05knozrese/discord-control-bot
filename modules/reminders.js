const fs = require("fs");

let reminders = [];

if (fs.existsSync("reminders.json")) {
  reminders = JSON.parse(fs.readFileSync("reminders.json"));
}

function save() {
  fs.writeFileSync("reminders.json", JSON.stringify(reminders, null, 2));
}

function init(client) {
  setInterval(async () => {
    const now = Date.now();
    const remaining = [];

    for (const r of reminders) {
      if (r.time <= now) {
        try {
          const ch = await client.channels.fetch(r.channel);
          ch.send(`<@${r.user}> ⏰ Reminder: ${r.msg}`);
        } catch {}
      } else {
        remaining.push(r);
      }
    }

    reminders = remaining;
    save();
  }, 5000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!remind") {
    const time = args[1];
    const msg = args.slice(2).join(" ");

    let ms = 60000;
    if (time.endsWith("m")) ms = parseInt(time) * 60000;
    if (time.endsWith("h")) ms = parseInt(time) * 3600000;

    reminders.push({
      channel: m.channel.id,
      user: m.author.id,
      msg,
      time: Date.now() + ms
    });

    save();
    return m.reply("⏰ Reminder set");
  }
}

module.exports = { init, commands };
