const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const wrapperPath = path.join(__dirname, 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');
const wrapperPropertiesPath = path.join(__dirname, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');

function fixWrapper() {
  // If wrapper already exists, verify it's valid by checking size
  if (fs.existsSync(wrapperPath)) {
    const stats = fs.statSync(wrapperPath);
    if (stats.size > 50000) {  // Valid wrapper is ~82KB
      console.log('✓ gradle-wrapper.jar already exists and looks valid');
      return;
    }
    console.log('⚠️ gradle-wrapper.jar seems corrupted, removing...');
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

  console.log('🔄 Regenerating gradle wrapper...');
  console.log('   Gradle version:', gradleVersion);

  // Try to regenerate using gradle wrapper task if gradle is available
  try {
    execSync(`gradle wrapper --gradle-version ${gradleVersion} --project-dir android`, {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log('✓ Successfully regenerated gradle wrapper using gradle command');
    return;
  } catch (e) {
    console.log('⚠️ gradle command failed, trying alternative methods...');
  }

  // Check if we have a local gradlew that can self-download
  const gradlewPath = path.join(__dirname, 'android', 'gradlew');
  if (fs.existsSync(gradlewPath)) {
    try {
      console.log('🔄 Attempting to use gradlew to download wrapper...');
      execSync('./gradlew wrapper', {
        cwd: path.join(__dirname, 'android'),
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' }
      });
      console.log('✓ Successfully downloaded wrapper using gradlew');
      return;
    } catch (e) {
      console.log('⚠️ gradlew wrapper command also failed');
    }
  }

  console.error('❌ Failed to regenerate gradle wrapper');
  console.log('');
  console.log('Please ensure one of the following is available:');
  console.log('  1. gradle command in PATH');
  console.log('  2. Valid gradlew script in android/ directory');
  console.log('');
  console.log('Or manually install Gradle from:');
  console.log(`  https://services.gradle.org/distributions/gradle-${gradleVersion}-all.zip`);
  process.exit(1);
}

fixWrapper();