import fetch from "node-fetch";

async function run() {
  const pin = "20010774";
  const res = await fetch(`https://api.tecnogafas.com.ar/login?data=${pin}`, {
    method: "POST"
  });
  console.log("Login status:", res.status);
  const text = await res.text();
  console.log("Login res:", text);
}

run();
