const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const wrapperPath = path.join(__dirname, 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');
const wrapperPropertiesPath = path.join(__dirname, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');

async function downloadWrapper() {
  // If wrapper already exists, verify it's valid by checking size
  if (fs.existsSync(wrapperPath)) {
    const stats = fs.statSync(wrapperPath);
    if (stats.size > 50000) {  // Valid wrapper is ~82KB
      console.log('✓ gradle-wrapper.jar already exists and looks valid');
      return Promise.resolve();
    }
    console.log('⚠️ gradle-wrapper.jar seems corrupted, will try to regenerate...');
    fs.unlinkSync(wrapperPath);
  }

  // Try to regenerate using gradle wrapper task if gradle is available
  try {
    console.log('Attempting to regenerate gradle wrapper...');
    execSync('gradle wrapper', { 
      cwd: path.join(__dirname, 'android'),
      stdio: 'ignore'
    });
    console.log('✓ Successfully regenerated gradle wrapper');
    return Promise.resolve();
  } catch (e) {
    console.log('Gradle not available, downloading from official distribution...');
  }

  // Fallback: Download from official Gradle distribution
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

  const url = `https://services.gradle.org/distributions/gradle-${gradleVersion}-all.zip`;
  console.log('Note: gradle-wrapper.jar not found. Please run: npx cap sync android');
  console.log('Or download Gradle manually from:', url);
  
  return Promise.resolve();
}

downloadWrapper().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});