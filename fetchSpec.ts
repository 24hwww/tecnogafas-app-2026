import fs from "node:fs";

fetch("https://api.tecnogafas.com.ar/openapi-spec")
	.then((res) => res.text())
	.then((data) => {
		fs.writeFileSync("openapi-spec.json", data);
		console.log("Spec saved to openapi-spec.json");
	});
