// src/routes/syncRoutes.js - VERSIÓN CORREGIDA
import express from 'express';
import { 
    bulkSync, 
    getChangesSince, 
    getSyncStats
    // 🔧 QUITAR: checkConflicts, resolveConflict (no existen en syncController.js)
} from '../controller/syncController.js';// 🆕 AGREGAR ESTA IMPORTACIÓN

const router = express.Router();

// 🆕 RUTAS DE SINCRONIZACIÓN

// Sincronización por lotes - El endpoint principal
router.post('/bulk', bulkSync); // 🔧 AGREGAR authJwt

// Obtener cambios desde un timestamp específico
router.get('/changes',  getChangesSince); // 🔧 AGREGAR authJwt

// Obtener estadísticas de sincronización
router.get('/stats',  getSyncStats); // 🔧 AGREGAR authJwt

// 🆕 RUTAS ESPECÍFICAS PARA TESTING Y DEBUGGING

// Forzar sincronización completa (desarrollo/testing)
router.post('/force-full',  async (req, res) => {
    try {
        // Solo en desarrollo
        if (process.env.NODE_ENV !== 'development') {
            return res.status(403).json({ message: "Endpoint solo disponible en desarrollo" });
        }
        
        const User = (await import('../models/User.js')).default;
        const allUsers = await User.find({ 
            $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }] 
        }).select('-password');
        
        res.status(200).json({
            message: "Sincronización completa",
            users: allUsers,
            count: allUsers.length,
            serverTime: Date.now()
        });
    } catch (error) {
        res.status(500).json({ message: "Error en sincronización completa", error: error.message });
    }
});

// Reset de sincronización (desarrollo/testing)
router.post('/reset', async (req, res) => {
    try {
        // Solo en desarrollo
        if (process.env.NODE_ENV !== 'development') {
            return res.status(403).json({ message: "Endpoint solo disponible en desarrollo" });
        }
        
        const User = (await import('../models/User.js')).default;
        await User.updateMany({}, { 
            lastModified: new Date(),
            syncVersion: 1,
            isDeleted: false
        });
        
        res.status(200).json({ message: "Estado de sincronización reseteado" });
    } catch (error) {
        res.status(500).json({ message: "Error reseteando sincronización", error: error.message });
    }
});

export default router;