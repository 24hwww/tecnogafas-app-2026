import fs from 'fs';

const oldSpec = JSON.parse(fs.readFileSync('openapi-spec.json', 'utf8'));
const newSpec = JSON.parse(fs.readFileSync('openapi-spec-new.json', 'utf8'));

console.log('Paths in old:', Object.keys(oldSpec.paths).length);
console.log('Paths in new:', Object.keys(newSpec.paths).length);

for (const p of Object.keys(newSpec.paths)) {
    if (!oldSpec.paths[p]) {
        console.log('NEW PATH:', p);
    }
}
for (const [p, pathObj] of Object.entries(newSpec.paths)) {
    if (oldSpec.paths[p]) {
        for (const [method, mObj] of Object.entries((pathObj as any))) {
            if (!(oldSpec.paths[p] as any)[method]) {
                console.log('NEW METHOD in', p, ':', method);
            }
        }
    }
}
