const https = require("node:https");
https
	.get("https://api.tecnogafas.com.ar/openapi-spec", (resp) => {
		let data = "";
		resp.on("data", (chunk) => {
			data += chunk;
		});
		resp.on("end", () => {
			console.log(data);
		});
	})
	.on("error", (err) => {
		console.log(`Error: ${err.message}`);
	});
