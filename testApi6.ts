import fetch from "node-fetch";

async function run() {
  const pin = "20010774"; // real seller logic
  const loginRes = await fetch(`https://api.tecnogafas.com.ar/login?data=${pin}`, { method: "POST" });
  const root = await loginRes.json();
  const token = root.user.id;

  const payload = {
    client_id: 1520, // test client created earlier
    notes: "Test order",
    discount: "0",
    recargo: "0",
    transport: "TestTransport",
    methodpay: "cash",
    iva: 21,
    products: [
      {
        product_id: 23725,
        variation_id: 23726,
        quantity: 1,
        price: 58000
      }
    ]
  };

  const res = await fetch(`https://api.tecnogafas.com.ar/pedido`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  console.log("Create order status:", res.status);
  const text = await res.text();
  console.log("Create order res:", text);
}

run();
