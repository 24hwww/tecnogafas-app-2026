import fetch from "node-fetch";

async function run() {
  const payload = {
    products: [
      { product_id: -1, variation_id: -1, price: 42000, stock: 1 }
    ]
  };

  const res = await fetch(`https://api.tecnogafas.com.ar/producto/verificar`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  console.log("verify status:", res.status);
  const text = await res.text();
  console.log("verify res:", text);
}

run();
