const fs = require("fs");

function save(name, data) {
  fs.writeFileSync(`./${name}.json`, JSON.stringify(data));
}

function load(name) {
  try {
    return JSON.parse(fs.readFileSync(`./${name}.json`));
  } catch {
    return null;
  }
}

module.exports = { save, load };
