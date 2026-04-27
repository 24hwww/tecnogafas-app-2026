import { apiService } from './src/services/apiService';
import fetch from "node-fetch";

async function testEmail() {
  const sellerInfo = await apiService.loginSeller('20010774');

  console.log(`Enviando email para el orderId: 26340...`);
  const res = await fetch(`https://api.tecnogafas.com.ar/pedido/26340/enviar`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sellerInfo?.id}` }
  });
  console.log("STATUS:", res.status);
  console.log("TEXT:", await res.text());
}
testEmail();
