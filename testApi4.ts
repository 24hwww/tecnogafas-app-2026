import fetch from "node-fetch";

async function run() {
  const res = await fetch(`https://api.tecnogafas.com.ar/clientes`);
  console.log("Status:", res.status);
  const json = await res.json();
  console.log("Sample client:", JSON.stringify(json.data[0], null, 2));
}

run();
