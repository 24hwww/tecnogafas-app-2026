import fetch from "node-fetch";

async function run() {
  const pin = "20010774"; // real seller logic
  const loginRes = await fetch(`https://api.tecnogafas.com.ar/login?data=${pin}`, { method: "POST" });
  const root = await loginRes.json();
  const token = root.user.id;
  
  const clientId = 1520;
  const payload = {
    email: "test_edited@example.com",
    first_name: "TestEdited",
    last_name: "UserEdited"
  };

  const res = await fetch(`https://api.tecnogafas.com.ar/cliente/${clientId}`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  console.log("Modify client status:", res.status);
  const text = await res.text();
  console.log("Modify client res:", text);
}

run();
