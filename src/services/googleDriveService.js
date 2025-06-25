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
    await drive.files.delete({
      fileId: fileId,
    });
    return true;
  } catch (error) {
    console.error('Error deleting from Google Drive:', error);
    throw error;
  }
};