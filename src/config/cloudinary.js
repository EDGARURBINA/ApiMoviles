import { v2 as cloudinary } from 'cloudinary';

// Configuración con URL completa
if (process.env.CLOUDINARY_URL) {
  // Cloudinary automáticamente parsea la URL cuando está en CLOUDINARY_URL
  cloudinary.config({
    secure: true
  });
} else {
  console.error('❌ CLOUDINARY_URL no está definida en las variables de entorno');
}

export default cloudinary;