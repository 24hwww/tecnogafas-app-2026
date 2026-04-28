const https = require('https');

https.get('https://api.tecnogafas.com.ar/productos', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const noVars = json.data.filter(p => !p.variaciones);
    console.log("Without variaciones count:", noVars.length);
    console.log(JSON.stringify(noVars.slice(0, 5), null, 2));
  });
});
