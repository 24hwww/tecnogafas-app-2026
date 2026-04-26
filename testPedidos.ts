import fetch from "node-fetch";

async function run() {
  const pin = "20010774"; 
  const loginRes = await fetch(`https://api.tecnogafas.com.ar/login?data=${pin}`, { method: "POST" });
  if (!loginRes.ok) {
     console.log("login fail", loginRes.status)
     return;
  }
  const root = await loginRes.json();
  const token = root.user.id;
  
  const res1 = await fetch(`https://api.tecnogafas.com.ar/pedidos?userId=${token}`);
  console.log("pedidos with query status:", res1.status);
  if (res1.ok) {
    const t = await res1.json();
    console.log("query results:", t.data.slice(0, 1).map(o=>o.ID));
  }

  const res2 = await fetch(`https://api.tecnogafas.com.ar/pedidos/${token}`);
  console.log("pedidos with path status:", res2.status);
  if (res2.ok) {
    const t2 = await res2.json();
    console.log("path results:", t2.data.slice(0, 1).map(o=>o.ID));
  }
}

run();
