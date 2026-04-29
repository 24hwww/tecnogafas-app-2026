const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const wrapperPath = path.join(__dirname, 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');
const wrapperPropertiesPath = path.join(__dirname, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');

// Download file from URL to path
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirects
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadWrapper() {
  // If wrapper already exists, verify it's valid by checking size
  if (fs.existsSync(wrapperPath)) {
    const stats = fs.statSync(wrapperPath);
    if (stats.size > 50000) {  // Valid wrapper is ~82KB
      console.log('✓ gradle-wrapper.jar already exists and looks valid');
      return;
    }
    console.log('⚠️ gradle-wrapper.jar seems corrupted, will re-download...');
    fs.unlinkSync(wrapperPath);
  }

  // Read the Gradle version from wrapper properties
  let gradleVersion = '8.14.3';  // Default
  try {
    const propsContent = fs.readFileSync(wrapperPropertiesPath, 'utf8');
    const versionMatch = propsContent.match(/gradle-(\d+\.\d+(\.\d+)?)-/);
    if (versionMatch) {
      gradleVersion = versionMatch[1];
    }
  } catch (e) {
    console.log('Could not read gradle version from properties, using default:', gradleVersion);
  }

  // Download the gradle-wrapper.jar directly from the Gradle repository
  // The wrapper JAR is available at a specific path in the Gradle distribution
  const wrapperVersion = gradleVersion.replace(/\.\d+$/, '');  // Remove patch version for wrapper
  const url = `https://raw.githubusercontent.com/gradle/gradle/v${wrapperVersion}.0/gradle/wrapper/gradle-wrapper.jar`;
  
  console.log('⬇️ Downloading gradle-wrapper.jar...');
  console.log('   URL:', url);
  
  try {
    await downloadFile(url, wrapperPath);
    const stats = fs.statSync(wrapperPath);
    if (stats.size > 50000) {
      console.log(`✓ Successfully downloaded gradle-wrapper.jar (${stats.size} bytes)`);
    } else {
      throw new Error(`Downloaded file is too small (${stats.size} bytes)`);
    }
  } catch (e) {
    console.error('❌ Failed to download gradle-wrapper.jar:', e.message);
    console.log('');
    console.log('Alternative: Try running:');
    console.log('  npx cap sync android');
    console.log('');
    console.log('Or manually download Gradle from:');
    console.log(`  https://services.gradle.org/distributions/gradle-${gradleVersion}-all.zip`);
    process.exit(1);
  }
}

downloadWrapper().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});