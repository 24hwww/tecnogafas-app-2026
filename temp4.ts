import fs from "fs";

async function run() {
  const res = await fetch("https://api.tecnogafas.com.ar/swagger.json");
  const text = await res.text();
  fs.writeFileSync("swagger.json", text);
}

run();
