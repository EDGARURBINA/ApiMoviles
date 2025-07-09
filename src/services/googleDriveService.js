import { drive, FOLDER_ID } from '../config/googleDrive.js';
import fs from 'fs';

export const uploadImageToDrive = async (filePath, fileName, mimeType) => {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [FOLDER_ID],
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    // Hacer el archivo público para poder acceder a él
    await drive.permissions.create({
      fileId: response.data.id,
      resource: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Generar URL pública
    const imageUrl = `https://drive.google.com/uc?id=${response.data.id}`;

    return {
      fileId: response.data.id,
      imageUrl: imageUrl,
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
};

export const deleteImageFromDrive = async (fileId) => {
  try {
    // Validar que fileId existe
    if (!fileId) {
      console.log('No fileId provided, skipping deletion');
      return { 
        success: true, 
        message: 'No file to delete',
        skipped: true 
      };
    }

    console.log(`Attempting to delete file: ${fileId}`);

    // Intentar eliminar el archivo
    await drive.files.delete({
      fileId: fileId,
    });

    console.log(`File ${fileId} deleted successfully`);
    return { 
      success: true, 
      message: 'File deleted successfully',
      deleted: true 
    };

  } catch (error) {
    // Manejar específicamente el error 404 (archivo no encontrado)
    if (error.code === 404 || error.status === 404) {
      console.log(`File ${fileId} not found, probably already deleted`);
      return { 
        success: true, 
        message: 'File not found, probably already deleted',
        notFound: true 
      };
    }

    // Manejar error 403 (sin permisos)
    if (error.code === 403 || error.status === 403) {
      console.warn(`Insufficient permissions to delete file ${fileId}`);
      return { 
        success: false, 
        message: 'Insufficient permissions to delete file',
        error: 'PERMISSION_DENIED' 
      };
    }

    // Para otros errores, loggear pero no fallar la operación
    console.error(`Error deleting file ${fileId} from Google Drive:`, error.message);
    return { 
      success: false, 
      message: 'Error deleting file from Drive',
      error: error.message 
    };
  }
};

// Función adicional para verificar si un archivo existe
export const fileExistsInDrive = async (fileId) => {
  try {
    if (!fileId) return false;
    
    await drive.files.get({ 
      fileId: fileId,
      fields: 'id,name' 
    });
    
    return true;
  } catch (error) {
    if (error.code === 404 || error.status === 404) {
      return false;
    }
    // Para otros errores, asumir que existe para evitar eliminar por error
    console.warn(`Error checking file existence: ${error.message}`);
    return true;
  }
};

// Función para eliminar múltiples archivos
export const deleteMultipleImagesFromDrive = async (fileIds) => {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return { success: true, message: 'No files to delete', results: [] };
  }

  const results = [];
  
  for (const fileId of fileIds) {
    const result = await deleteImageFromDrive(fileId);
    results.push({ fileId, ...result });
  }

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  return {
    success: successCount === totalCount,
    message: `${successCount}/${totalCount} files processed successfully`,
    results
  };
};