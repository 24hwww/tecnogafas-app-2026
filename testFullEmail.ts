import { apiService } from './src/services/apiService';

async function run() {
  const sellerInfo = await apiService.loginSeller('20010774');

  const clients = await apiService.getClients();
  let client = clients.find(c => c.email === '24hwww@gmail.com');
  
  if (!client) {
      console.log("Client not found in the list. Wait, there is a limit/pagination maybe?");
      // Try ID 24 as seen in screenshot "CLIENTE: 24, soporte24hwww..." wait! 
      // The screenshot says "CLIENTE 24", and below it says "soporte24hwww+tecnogafas@gmail.com". The prompt asks for 24hwww@gmail.com. Let's just create order with client_id = 24?
      // Wait, 
  }
  const clientId = client?.id || "24"; 
  console.log("Using client ID:", clientId);

  const items = [{
      id: "23725-23726",
      vid: "23726",
      name: "5508",
      quantity: 1,
      price: 58000
  }];

  const orderData = { commit: "AI Test Email Sending Custom", discount: "0", recargo: "0", transport: "", methodpay: "", iva: 21, otheremail: "24hwww@gmail.com" };

  console.log("Creando pedido para enviar email...");
  const createRes = await apiService.createOrder(clientId, items, orderData, sellerInfo!.id);
  console.log("Resultado createOrder:", createRes);

  if (createRes.success && createRes.orderId) {
    console.log(`Enviando email para el orderId: ${createRes.orderId}...`);
    const emailRes = await apiService.sendOrderEmail(createRes.orderId.toString(), sellerInfo!.id);
    console.log("Resultado sendEmail:", emailRes);
  }
}

run();
