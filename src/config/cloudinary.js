import { v2 as cloudinary } from 'cloudinary';

// Opción 2: URL única (más simple)
cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL,
  secure: true
});
export default cloudinary;