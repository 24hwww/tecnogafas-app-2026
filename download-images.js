import fs from 'fs';
import https from 'https';
import path from 'path';

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    ensureDir(dest);

    const request = https.get(url, (response) => {
      // Manejar redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return resolve(downloadFile(response.headers.location, dest));
      }

      // Validar status
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url} - Status: ${response.statusCode}`));
      }

      // Validar tipo
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('image')) {
        return reject(new Error(`Invalid content type for ${url}: ${contentType}`));
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const main = async () => {
  const base = process.cwd();

  const files = [
    {
      url: 'https://placehold.co/512/1662E1/FFF/png?font=montserrat&text=TG',
      dest: path.join(base, 'public/icon-512.png'),
    },
    {
      url: 'https://placehold.co/1024/1662E1/FFF/png?font=montserrat&text=TG',
      dest: path.join(base, 'assets/icon.png'),
    },
    {
      url: 'https://placehold.co/1024/1662E1/FFF/png?font=montserrat&text=TG',
      dest: path.join(base, 'assets/icon-foreground.png'),
    },
    {
      url: 'https://placehold.co/1024/1662E1/FFF/png?font=montserrat&text=TG',
      dest: path.join(base, 'assets/icon-only.png'),
    },
    {
      url: 'https://placehold.co/512/1662E1/FFF/png?font=montserrat&text=TecnoGafas',
      dest: path.join(base, 'assets/logo.png'),
    },
    {
      url: 'https://placehold.co/2732/1662E1/FFF/png?font=montserrat&text=TG',
      dest: path.join(base, 'assets/splash.png'),
    },
    {
      url: 'https://placehold.co/2732/1E1E1E/FFF/png?font=montserrat&text=TG',
      dest: path.join(base, 'assets/splash-dark.png'),
    },
  ];

  await Promise.all(files.map((f) => downloadFile(f.url, f.dest)));

  console.log('✅ Images replaced successfully');
};

main().catch((err) => {
  console.error('❌ Error downloading assets:', err);
  process.exit(1);
});
