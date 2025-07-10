import cloudinary from '../config/cloudinary.js';
import fs from 'fs';

export const uploadImageToCloudinary = async (filePath, fileName) => {
  try {
    console.log(`Uploading ${fileName} to Cloudinary...`);

    const result = await cloudinary.uploader.upload(filePath, {
      // Carpeta donde guardar (similar a tu FOLDER_ID de Drive)
      folder: 'user_images',
      
      // Nombre público del archivo
      public_id: fileName.split('.')[0], // Sin extensión
      
      // Optimizaciones automáticas
      quality: 'auto',
      fetch_format: 'auto',
      
      // Transformaciones opcionales
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' }, // Máximo 1000x1000
        { quality: 85 } // Compresión del 85%
      ]
    });

    console.log(`Image uploaded successfully: ${result.public_id}`);

    return {
      fileId: result.public_id, // ID único de Cloudinary
      imageUrl: result.secure_url, // URL pública HTTPS
      originalUrl: result.url, // URL HTTP (opcional)
    };

  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

export const deleteImageFromCloudinary = async (publicId) => {
  try {
    // Validar que publicId existe
    if (!publicId) {
      console.log('No publicId provided, skipping deletion');
      return { 
        success: true, 
        message: 'No file to delete',
        skipped: true 
      };
    }

    console.log(`Attempting to delete image: ${publicId}`);

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      console.log(`Image ${publicId} deleted successfully`);
      return { 
        success: true, 
        message: 'Image deleted successfully',
        deleted: true 
      };
    } else if (result.result === 'not found') {
      console.log(`Image ${publicId} not found, probably already deleted`);
      return { 
        success: true, 
        message: 'Image not found, probably already deleted',
        notFound: true 
      };
    } else {
      console.warn(`Unexpected result deleting ${publicId}:`, result);
      return { 
        success: false, 
        message: 'Unexpected result from Cloudinary',
        error: result.result 
      };
    }

  } catch (error) {
    console.error(`Error deleting image ${publicId} from Cloudinary:`, error.message);
    return { 
      success: false, 
      message: 'Error deleting image from Cloudinary',
      error: error.message 
    };
  }
};

// Función para verificar si una imagen existe
export const imageExistsInCloudinary = async (publicId) => {
  try {
    if (!publicId) return false;
    
    const result = await cloudinary.api.resource(publicId);
    return result && result.public_id === publicId;
    
  } catch (error) {
    if (error.error && error.error.http_code === 404) {
      return false;
    }
    console.warn(`Error checking image existence: ${error.message}`);
    return true; // Asumir que existe en caso de error
  }
};

// Función para eliminar múltiples imágenes
export const deleteMultipleImagesFromCloudinary = async (publicIds) => {
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return { success: true, message: 'No images to delete', results: [] };
  }

  const results = [];
  
  for (const publicId of publicIds) {
    const result = await deleteImageFromCloudinary(publicId);
    results.push({ publicId, ...result });
  }

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  return {
    success: successCount === totalCount,
    message: `${successCount}/${totalCount} images processed successfully`,
    results
  };
};

// Función para generar URLs con transformaciones dinámicas
export const getTransformedImageUrl = (publicId, transformations = {}) => {
  try {
    return cloudinary.url(publicId, {
      secure: true,
      ...transformations
    });
  } catch (error) {
    console.error('Error generating transformed URL:', error);
    return null;
  }
};

// Limpiar archivo temporal después de subir
export const cleanupTempFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Temp file cleaned up: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up temp file ${filePath}:`, error.message);
  }
};