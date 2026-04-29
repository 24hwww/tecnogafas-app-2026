const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'public', 'icon-512.png');
const destDir = path.join(__dirname, 'assets');
const dest = path.join(destDir, 'icon.png');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
}

if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    fs.copyFileSync(src, path.join(destDir, 'icon-only.png'));
    fs.copyFileSync(src, path.join(destDir, 'icon-foreground.png'));
    fs.copyFileSync(src, path.join(destDir, 'logo.png'));
    fs.copyFileSync(src, path.join(destDir, 'splash.png'));
    fs.copyFileSync(src, path.join(destDir, 'splash-dark.png'));
    console.log('Copied icon-512.png to assets/ for Capacitor');
} else {
    console.error('Source icon-512.png not found');
}
