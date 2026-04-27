import { apiService } from './src/services/apiService';

async function testEmail() {
  const sellerInfo = await apiService.loginSeller('20010774');
  
  const items = [{
      id: "23725-23726",
      vid: "23726",
      name: "5508",
      quantity: 1,
      price: 58000
  }];

  const orderData = { commit: "AI Test Email Sending", discount: "0", recargo: "0", transport: "", methodpay: "", iva: 21, otheremail: "24hwww@gmail.com" };

  console.log("Creando pedido para enviar email...");
  const createRes = await apiService.createOrder("1523", items, orderData, sellerInfo!.id);
  console.log("Resultado createOrder:", createRes);

  if (createRes.success && createRes.orderId) {
    console.log(`Enviando email para el orderId: ${createRes.orderId}...`);
    const emailRes = await apiService.sendOrderEmail(createRes.orderId.toString(), sellerInfo!.id);
    console.log("Resultado sendEmail:", emailRes);
  }
}
testEmail();
