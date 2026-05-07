import fs from 'fs';
import https from 'https';

https
  .get('https://api.tecnogafas.com.ar/openapi-spec', (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      fs.writeFileSync('openapi-spec-new.json', data);
      console.log('Done');
    });
  })
  .on('error', (err) => {
    console.log('Error: ' + err.message);
  });
