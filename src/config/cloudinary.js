// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Asegurar que dotenv esté cargado
dotenv.config();

// Configuración con variables separadas (más confiable)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

console.log('🔍 Cloudinary config debug:');
console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? 'EXISTS' : 'MISSING');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? 'EXISTS' : 'MISSING');

export default cloudinary;