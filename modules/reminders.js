const fs = require("fs");

let reminders = [];

if (fs.existsSync("reminders.json")) {
  reminders = JSON.parse(fs.readFileSync("reminders.json"));
}

function save() {
  fs.writeFileSync("reminders.json", JSON.stringify(reminders));
}

function init(client) {
  setInterval(async () => {
    const now = Date.now();

    reminders = reminders.filter(async (r) => {
      if (r.time <= now) {
        try {
          const ch = await client.channels.fetch(r.channel);
          ch.send(`⏰ Reminder: ${r.msg}`);
        } catch {}
        return false;
      }
      return true;
    });

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
      msg,
      time: Date.now() + ms
    });

    save();
    return m.reply("⏰ Reminder set");
  }
}

module.exports = { init, commands };
