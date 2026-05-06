const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const wrapperPath = path.join(
	__dirname,
	"android",
	"gradle",
	"wrapper",
	"gradle-wrapper.jar",
);
const url =
	"https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar";

async function downloadWrapper() {
	if (fs.existsSync(wrapperPath)) {
		console.log("Downloading fresh gradle-wrapper.jar to fix corruption...");
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(wrapperPath);
			https
				.get(url, (response) => {
					response.pipe(file);
					file.on("finish", () => {
						file.close();
						console.log("Successfully downloaded gradle-wrapper.jar");
						resolve();
					});
				})
				.on("error", (err) => {
					fs.unlink(wrapperPath, () => {});
					console.error("Error downloading gradle-wrapper.jar:", err.message);
					reject(err);
				});
		});
	} else {
		console.log(
			"android/gradle/wrapper/gradle-wrapper.jar not found, skipping download",
		);
		return Promise.resolve();
	}
}

downloadWrapper().catch((_e) => process.exit(1));
