const https = require('https');
const fs = require('fs');
https
  .get('https://api.tecnogafas.com.ar/openapi-spec', (resp) => {
    let data = '';
    resp.on('data', (chunk) => {
      data += chunk;
    });
    resp.on('end', () => {
      fs.writeFileSync('spec.json', data);
    });
  })
  .on('error', (err) => {
    console.log('Error: ' + err.message);
  });
