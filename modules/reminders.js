let reminders = [];

function init(client) {
  setInterval(() => {
    const now = Date.now();

    reminders = reminders.filter(r => {
      if (r.time <= now) {
        client.channels.fetch(r.channel).then(c =>
          c.send(`⏰ Reminder: ${r.msg}`)
        );
        return false;
      }
      return true;
    });
  }, 5000);
}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!remind") {
    const time = args[1];
    const msg = args.slice(2).join(" ");

    let ms = time.endsWith("m") ? parseInt(time) * 60000 : parseInt(time) * 3600000;

    reminders.push({
      channel: m.channel.id,
      msg,
      time: Date.now() + ms
    });

    return m.reply("⏰ Reminder set");
  }
}

module.exports = { init, commands };
