// D:/dashboard/src/utils/fileValidators.js

export const validateImage = (file) => {
  if (!file) {
    throw new Error('لم يتم اختيار ملف.');
  }

  if (typeof file !== 'object' || !(file instanceof File)) {
    throw new Error('الملف غير صالح.');
  }

  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  const maxSize = 5 * 1024 * 1024;

  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة (jpeg, png, gif, webp).');
  }

  if (file.size > maxSize) {
    throw new Error('حجم الملف كبير جدًا. الحد الأقصى هو 5 ميجابايت.');
  }

  const fileName = file.name.trim();
  if (fileName.length === 0 || fileName.length > 255) {
    throw new Error('اسم الملف غير صالح.');
  }
};

export const validateVideo = (file) => {
  if (!file) {
    throw new Error('لم يتم اختيار ملف.');
  }

  if (typeof file !== 'object' || !(file instanceof File)) {
    throw new Error('الملف غير صالح.');
  }

  const allowedTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska'
  ];

  const maxSize = 50 * 1024 * 1024;

  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('نوع الفيديو غير مدعوم. المسموح: MP4, WebM, OGG, MOV, AVI, MKV.');
  }

  if (file.size > maxSize) {
    throw new Error('حجم الفيديو كبير جدًا. الحد الأقصى هو 50 ميجابايت.');
  }

  const fileName = file.name.trim();
  if (fileName.length === 0 || fileName.length > 255) {
    throw new Error('اسم الملف غير صالح.');
  }

  const extension = fileName.split('.').pop().toLowerCase();
  const allowedExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];

  if (!allowedExtensions.includes(extension)) {
    throw new Error('امتداد الفيديو غير مسموح به.');
  }
};

export const validateDocument = (file) => {
  if (!file) {
    throw new Error('لم يتم اختيار ملف.');
  }

  if (typeof file !== 'object' || !(file instanceof File)) {
    throw new Error('الملف غير صالح.');
  }

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  const maxSize = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('نوع الملف غير مدعوم. المسموح: PDF, Word, Excel, نص.');
  }

  if (file.size > maxSize) {
    throw new Error('حجم الملف كبير جدًا. الحد الأقصى هو 10 ميجابايت.');
  }

  const fileName = file.name.trim();
  if (fileName.length === 0 || fileName.length > 255) {
    throw new Error('اسم الملف غير صالح.');
  }
};

export const validateFile = (file, options = {}) => {
  const {
    allowedTypes = [],
    maxSize = 10 * 1024 * 1024,
    type = 'general'
  } = options;

  if (!file) {
    throw new Error('لم يتم اختيار ملف.');
  }

  if (typeof file !== 'object' || !(file instanceof File)) {
    throw new Error('الملف غير صالح.');
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error(`نوع الملف غير مدعوم للنوع: ${type}`);
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    throw new Error(`حجم الملف كبير جدًا. الحد الأقصى هو ${maxSizeMB} ميجابايت.`);
  }

  const fileName = file.name.trim();
  if (fileName.length === 0 || fileName.length > 255) {
    throw new Error('اسم الملف غير صالح.');
  }

  const maliciousPatterns = /\.(exe|bat|cmd|sh|js|php|asp|aspx|jsp|jar|dll)$/i;
  if (maliciousPatterns.test(fileName)) {
    throw new Error('نوع الملف غير آمن.');
  }

  return true;
};

export const getFileTypeCategory = (fileType) => {
  if (!fileType) return 'unknown';

  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('audio/')) return 'audio';
  if (fileType.startsWith('application/pdf')) return 'pdf';
  if (fileType.includes('word') || fileType.includes('excel') || fileType.includes('powerpoint')) return 'document';
  if (fileType.startsWith('text/')) return 'text';

  return 'other';
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 ب';

  const k = 1024;
  const sizes = ['ب', 'ك.ب', 'م.ب', 'ج.ب'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default {
  validateImage,
  validateVideo,
  validateDocument,
  validateFile,
  getFileTypeCategory,
  formatFileSize
};
