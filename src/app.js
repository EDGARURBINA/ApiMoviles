import express from 'express';
import cors from 'cors';
import authRoutes from "./routes/authRoutes.js";
import syncRoutes from "./routes/syncRoutes.js"; // 🆕 NUEVA IMPORTACIÓN
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Crear directorio de uploads si no existe
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads/temp');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 🔄 AUMENTADO para sync por lotes
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🆕 MIDDLEWARE para logging de requests (opcional)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use("/api/auth", authRoutes);        // ✅ EXISTENTE - Autenticación y CRUD
app.use("/api/sync", syncRoutes);        // 🆕 NUEVO - Sincronización

// 🆕 MIDDLEWARE para manejo de errores
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        message: "Error interno del servidor", 
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
});

// 🆕 RUTA para health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

export default app;
