import User from '../models/User.js';
import { 
    uploadImageToCloudinary, 
    deleteImageFromCloudinary, 
    cleanupTempFile 
} from '../services/cloudinaryService.js';

// 🆕 SINCRONIZACIÓN POR LOTES
export const bulkSync = async (req, res) => {
    try {
        const { operations } = req.body;
        
        if (!operations || !Array.isArray(operations)) {
            return res.status(400).json({ 
                message: "Se requiere un array de operaciones" 
            });
        }

        console.log(`🔄 Procesando ${operations.length} operaciones de sincronización`);
        
        const results = [];
        
        for (const operation of operations) {
            try {
                let result;
                
                switch (operation.type) {
                    case 'CREATE':
                        result = await createUserFromSync(operation);
                        break;
                    case 'UPDATE':
                        result = await updateUserFromSync(operation);
                        break;
                    case 'DELETE':
                        result = await deleteUserFromSync(operation);
                        break;
                    default:
                        result = { 
                            success: false, 
                            error: `Operación no válida: ${operation.type}` 
                        };
                }
                
                results.push({
                    operationId: operation.operationId || operation.id,
                    type: operation.type,
                    success: result.success,
                    data: result.data,
                    error: result.error,
                    syncVersion: result.data?.syncVersion
                });
                
            } catch (error) {
                console.error(`Error en operación ${operation.type}:`, error);
                results.push({
                    operationId: operation.operationId || operation.id,
                    type: operation.type,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.length - successCount;
        
        console.log(`✅ Sincronización completada: ${successCount} éxitos, ${failedCount} fallos`);
        
        res.status(200).json({
            message: "Sincronización por lotes completada",
            serverTime: Date.now(),
            summary: {
                total: results.length,
                success: successCount,
                failed: failedCount
            },
            results
        });
        
    } catch (error) {
        console.error('Error en sincronización por lotes:', error);
        res.status(500).json({ 
            message: "Error en sincronización por lotes", 
            error: error.message 
        });
    }
};

// 🆕 OBTENER CAMBIOS DESDE TIMESTAMP
export const getChangesSince = async (req, res) => {
    try {
        const { since, limit = 100 } = req.query;
        const sinceDate = since ? new Date(parseInt(since)) : new Date(0);
        
        console.log(`📥 Obteniendo cambios desde: ${sinceDate.toISOString()}`);
        
        // Obtener usuarios modificados (activos)
        const modifiedUsers = await User.find({
            lastModified: { $gte: sinceDate },
            isDeleted: false
        }).limit(parseInt(limit)).select('-password');
        
        // Obtener usuarios eliminados
        const deletedUsers = await User.find({
            lastModified: { $gte: sinceDate },
            isDeleted: true
        }).limit(parseInt(limit)).select('_id lastModified syncVersion');
        
        const totalChanges = modifiedUsers.length + deletedUsers.length;
        
        res.status(200).json({
            message: "Cambios obtenidos exitosamente",
            serverTime: Date.now(),
            changes: {
                modified: modifiedUsers,
                deleted: deletedUsers,
                count: {
                    modified: modifiedUsers.length,
                    deleted: deletedUsers.length,
                    total: totalChanges
                }
            },
            hasMore: totalChanges >= parseInt(limit)
        });
        
    } catch (error) {
        console.error('Error obteniendo cambios:', error);
        res.status(500).json({ 
            message: "Error obteniendo cambios", 
            error: error.message 
        });
    }
};

// 🆕 ESTADÍSTICAS DE SINCRONIZACIÓN
export const getSyncStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ isDeleted: false });
        const deletedUsers = await User.countDocuments({ isDeleted: true });
        
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentlyModified = await User.countDocuments({
            lastModified: { $gte: last24h },
            isDeleted: false
        });
        
        const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weeklyModified = await User.countDocuments({
            lastModified: { $gte: last7days },
            isDeleted: false
        });
        
        res.status(200).json({
            totalUsers,
            deletedUsers,
            recentlyModified,
            weeklyModified,
            serverTime: Date.now(),
            dbStatus: 'connected'
        });
        
    } catch (error) {
        res.status(500).json({ 
            message: "Error obteniendo estadísticas", 
            error: error.message 
        });
    }
};

// ==================== FUNCIONES AUXILIARES ====================

const createUserFromSync = async (operation) => {
    try {
        const hashedPassword = await User.encryptPassword(
            operation.data.password || 'defaultPassword123'
        );
        
        const userData = {
            ...operation.data,
            password: hashedPassword,
            lastModified: new Date(),
            syncVersion: 1,
            clientId: operation.clientId || null
        };
        
        const newUser = new User(userData);
        const savedUser = await newUser.save();
        
        return {
            success: true,
            data: savedUser
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
};

const updateUserFromSync = async (operation) => {
    try {
        const user = await User.findById(operation.id);
        
        if (!user) {
            return { 
                success: false, 
                error: "Usuario no encontrado" 
            };
        }
        
        // Verificar conflicto de versión (opcional)
        if (user.syncVersion > (operation.syncVersion || 0)) {
            return { 
                success: false, 
                error: "Conflicto de versión detectado",
                conflictData: {
                    serverVersion: user.syncVersion,
                    clientVersion: operation.syncVersion || 0
                }
            };
        }
        
        Object.assign(user, operation.data);
        user.lastModified = new Date();
        user.syncVersion += 1;
        
        const updatedUser = await user.save();
        
        return {
            success: true,
            data: updatedUser
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
};

const deleteUserFromSync = async (operation) => {
    try {
        const user = await User.findById(operation.id);
        
        if (!user) {
            return { 
                success: false, 
                error: "Usuario no encontrado" 
            };
        }
        
        // Soft delete
        user.isDeleted = true;
        user.lastModified = new Date();
        user.syncVersion += 1;
        const deletedUser = await user.save();
        
        // Opcional: Eliminar imagen de Cloudinary
        if (user.imagePublicId) {
            try {
                await deleteImageFromCloudinary(user.imagePublicId);
            } catch (error) {
                console.warn('Error eliminando imagen:', error);
            }
        }
        
        return {
            success: true,
            data: { 
                _id: deletedUser._id, 
                isDeleted: true,
                syncVersion: deletedUser.syncVersion
            }
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
};