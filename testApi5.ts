import fetch from "node-fetch";

async function run() {
  const res = await fetch(`https://api.tecnogafas.com.ar/pedidos`);
  console.log("Status:", res.status);
  const json = await res.json();
  console.log("Sample order:", JSON.stringify(json.data[0], null, 2));
}

run();
