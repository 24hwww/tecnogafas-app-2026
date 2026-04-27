import { apiService } from './src/services/apiService';

async function testIt() {
  const orders = await apiService.getOrders();
  const lastOrder = orders[0];
  console.dir(lastOrder, { depth: null });
}
testIt();
