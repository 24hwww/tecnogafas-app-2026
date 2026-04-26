import fetch from "node-fetch";

async function run() {
  const pin = "20010774";
  const loginRes = await fetch(`https://api.tecnogafas.com.ar/login?data=${pin}`, { method: "POST" });
  const loginData = await loginRes.json();
  const token = loginData.user.id;
  console.log("Token:", token);

  const res = await fetch(`https://api.tecnogafas.com.ar/cliente`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      email: `test_${Date.now()}@example.com`,
      first_name: "Test",
      last_name: "User"
    })
  });
  console.log("Create client status:", res.status);
  const text = await res.text();
  console.log("Create client res:", text);
}

run();
