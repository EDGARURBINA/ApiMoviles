import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de Google Drive
const KEYFILEPATH = path.join(__dirname, 'service-account-key.json'); // Tu archivo de credenciales
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

export const drive = google.drive({ version: 'v3', auth });

// ID de la carpeta donde guardarás las imágenes (crea una carpeta en tu Google Drive)
export const FOLDER_ID = '19ibC-Jh59c6F_X8FgZsAAs-oNwjpK0R7';
