const path = require('path');
const fs = require('fs');

/**
 * Загружает файл (buffer) в облако imgbb или сохраняет локально.
 * @param {object} file - объект файла от multer (memoryStorage)
 * @param {string} folder - подпапка внутри uploads ('avatars', 'posts')
 * @returns {Promise<string>} URL картинки (imgbb) или имя файла (локально)
 */


async function uploadImage(file, folder = '') {
  if (!file) throw new Error('No file provided');

  if (process.env.IMGBB_API_KEY) {
    //  Загрузка на imgbb 
    const base64 = file.buffer.toString('base64');
    const formData = new FormData();
    formData.append('image', base64);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error ? result.error.message : 'Imgbb upload failed');
    }
    return result.data.url;
  } else {
    //  Локальное сохранение 
    const uploadDir = path.join(__dirname, '..', 'uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = folder ? `${folder}/${uniqueSuffix}${ext}` : `${uniqueSuffix}${ext}`;
    const filepath = path.join(__dirname, '..', 'uploads', filename);

    await fs.promises.writeFile(filepath, file.buffer);
    return filename;
  }
}

module.exports = uploadImage;