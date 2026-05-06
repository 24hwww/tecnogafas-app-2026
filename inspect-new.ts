import fs from "node:fs";

const newSpec = JSON.parse(fs.readFileSync("openapi-spec-new.json", "utf8"));

console.log(JSON.stringify(newSpec.paths["/pedido/{id}/estado"], null, 2));

// check schemas too
console.log("--- Schemas ---");
const oldSpec = JSON.parse(fs.readFileSync("openapi-spec.json", "utf8"));

for (const k of Object.keys(newSpec.components.schemas)) {
	if (!oldSpec.components.schemas[k]) {
		console.log("NEW SCHEMA", k);
	} else if (
		JSON.stringify(newSpec.components.schemas[k]) !==
		JSON.stringify(oldSpec.components.schemas[k])
	) {
		console.log("CHANGED SCHEMA", k);
	}
}
