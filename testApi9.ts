import fetch from "node-fetch";

async function run() {
  const pin = "20010774"; 
  const loginRes = await fetch(`https://api.tecnogafas.com.ar/login?data=${pin}`, { method: "POST" });
  const root = await loginRes.json();
  const token = root.user.id;
  
  const payload = {
    email: "test_1777206587890@example.com", // earlier created
    first_name: "TestEditedViaEmail",
    last_name: "UserEdited"
  };

  const res = await fetch(`https://api.tecnogafas.com.ar/cliente`, {
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
