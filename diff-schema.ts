import fs from 'fs';
const oldSpec = JSON.parse(fs.readFileSync('openapi-spec.json', 'utf8'));
const newSpec = JSON.parse(fs.readFileSync('openapi-spec-new.json', 'utf8'));

console.log('OLD:', JSON.stringify(oldSpec.components.schemas.OrderRequest.properties.products, null, 2));
console.log('NEW:', JSON.stringify(newSpec.components.schemas.OrderRequest.properties.products, null, 2));
