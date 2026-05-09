// Herramienta de diagnóstico para Dexie - Ejecutar en consola del navegador
async function debugDexie() {
  console.log('=== DIAGNÓSTICO COMPLETO DE DEXIE ===');
  
  try {
    // Importar la base de datos
    const { appDB } = await import('./src/stores/appDatabase.js');
    
    console.log('1. Verificando conexión a la base de datos...');
    console.log('   - Nombre de la DB:', appDB.name);
    console.log('   - Versión:', appDB.verno);
    
    console.log('\n2. Verificando tablas...');
    const tables = appDB.tables.map(table => table.name);
    console.log('   - Tablas disponibles:', tables);
    
    console.log('\n3. Revisando tabla selectedClient...');
    
    // Verificar si la tabla existe y tiene la estructura correcta
    if (appDB.selectedClient) {
      console.log('   - Tabla selectedClient encontrada');
      console.log('   - Schema:', appDB.selectedClient.schema);
      
      // Contar todos los registros
      const totalCount = await appDB.selectedClient.count();
      console.log('   - Total de registros:', totalCount);
      
      // Obtener todos los registros
      const allRecords = await appDB.selectedClient.toArray();
      console.log('   - Todos los registros:', allRecords);
      
      // Buscar registros con isSelected = true
      const selectedRecords = await appDB.selectedClient.filter(client => client.isSelected).toArray();
      console.log('   - Registros con isSelected=true:', selectedRecords);
      
      // Verificar si hay problemas con el filtro
      console.log('\n4. Probando diferentes filtros...');
      const filter1 = await appDB.selectedClient.where('isSelected').equals(true).toArray();
      console.log('   - Filtro where(isSelected).equals(true):', filter1);
      
      const filter2 = await appDB.selectedClient.filter(client => {
        console.log('     - Evaluando cliente:', client.id, client.isSelected);
        return client.isSelected === true;
      }).toArray();
      console.log('   - Filtro filter con log detallado:', filter2);
      
    } else {
      console.log('   - ERROR: Tabla selectedClient no encontrada');
    }
    
    console.log('\n5. Revisando tabla cart...');
    if (appDB.cart) {
      const cartItems = await appDB.cart.toArray();
      console.log('   - Items en carrito:', cartItems);
      console.log('   - Total items:', cartItems.length);
    }
    
    console.log('\n6. Probando guardar y recuperar un cliente de prueba...');
    
    // Limpiar datos de prueba anteriores
    await appDB.selectedClient.where('id').startsWith('test-').delete();
    
    // Crear cliente de prueba
    const testClient = {
      id: 'test-client-' + Date.now(),
      name: 'Cliente de Prueba',
      email: 'test@example.com',
      phone: '123456789',
      address: 'Dirección de prueba',
      billing_city: 'Ciudad de prueba',
      billing_state: 'Estado de prueba',
      cuit: '12345678901',
      isSelected: true
    };
    
    console.log('   - Guardando cliente de prueba:', testClient);
    await appDB.selectedClient.add(testClient);
    
    // Recuperar inmediatamente
    const retrieved = await appDB.selectedClient.get(testClient.id);
    console.log('   - Recuperado inmediatamente:', retrieved);
    
    // Probar el filtro que usa la app
    const filtered = await appDB.selectedClient.filter(client => client.isSelected).toArray();
    console.log('   - Recuperado con filter isSelected:', filtered);
    
    // Limpiar
    await appDB.selectedClient.delete(testClient.id);
    console.log('   - Cliente de prueba eliminado');
    
    console.log('\n=== DIAGNÓSTICO COMPLETADO ===');
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Hacer la función disponible globalmente
window.debugDexie = debugDexie;
console.log('🔍 Herramienta de diagnóstico lista. Ejecuta debugDexie() en la consola');
