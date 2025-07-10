// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Asegurar que dotenv esté cargado
dotenv.config();

// Configuración con URL completa
if (process.env.CLOUDINARY_URL) {
  // Cloudinary automáticamente parsea la URL cuando está en CLOUDINARY_URL
  cloudinary.config({
    secure: true
  });
  console.log('✅ Cloudinary configurado correctamente');
} else {
  console.error('❌ CLOUDINARY_URL no está definida en las variables de entorno');
  console.log('🔍 Available env vars:', Object.keys(process.env).filter(key => key.includes('CLOUD')));
}

export default cloudinary;