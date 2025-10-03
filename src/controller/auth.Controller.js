import jwt from 'jsonwebtoken';
import config from '../config.js'; 
import { 
  uploadImageToCloudinary, 
  deleteImageFromCloudinary, 
  cleanupTempFile 
} from '../services/cloudinaryService.js';
import User from '../models/User.js';

export const signin = async (req, res, next) => {
    try {
        const userFound = await User.findOne({ email: req.body.email }).populate("roles");

        if (!userFound) {
            res.status(400).json({ message: "Usuario no encontrado" });
            return;
        }

        const matchPassword = await User.comparePassword(req.body.password, userFound.password);
        if (!matchPassword) {
            res.status(401).json({ error: true, message: "Contraseña incorrecta" });
            return;
        }

        const token = jwt.sign({ id: userFound._id }, config.SECRET, {
            expiresIn: 86400,
        });

        res.status(200).json({
            message: "Inicio de sesión exitoso",
            token,
            user: {
                id: userFound._id,
                name: userFound.name,
                email: userFound.email,
                imageUrl: userFound.imageUrl,
                roles: userFound.roles,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Hubo un error en el servidor", error });
    }
};


const processingEmails = new Set();

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, phone, notes, age, address } = req.body;
    
    // 🔧 NORMALIZAR EMAIL DESDE EL INICIO
    const normalizedEmail = email?.toLowerCase().trim();
    
    console.log('🔄 Procesando signup:', normalizedEmail);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);
    
    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ 
        message: "Los campos name, email y password son obligatorios" 
      });
    }

    // 🆕 VERIFICAR SI YA SE ESTÁ PROCESANDO ESTE EMAIL
    if (processingEmails.has(normalizedEmail)) {
      console.log(`⏳ Email ${normalizedEmail} ya se está procesando, rechazando request duplicado`);
      
      // Limpiar archivo temporal si existe
      if (req.file) {
        cleanupTempFile(req.file.path);
      }
      
      return res.status(409).json({ 
        message: "Este email ya se está procesando, por favor espera",
        code: "EMAIL_PROCESSING"
      });
    }

    // 🆕 MARCAR EMAIL COMO "EN PROCESAMIENTO"
    processingEmails.add(normalizedEmail);

    try {
      // ✅ VERIFICAR SI EL EMAIL YA EXISTE
      const userExists = await User.findOne({ email: normalizedEmail });
      if (userExists) {
        console.log(`📋 Usuario ya existe: ${normalizedEmail} (ID: ${userExists._id})`);
        
        // Limpiar archivo temporal
        if (req.file) {
          cleanupTempFile(req.file.path);
        }
        
        // 🔧 RETORNAR DATOS DEL USUARIO EXISTENTE EN LUGAR DE ERROR
        const token = jwt.sign({ id: userExists._id }, config.SECRET, {
          expiresIn: 86400,
        });

        return res.status(200).json({ // 200 en lugar de 400
          message: "Usuario ya registrado, iniciando sesión",
          token,
          user: {
            _id: userExists._id,
            name: userExists.name,
            email: userExists.email,
            phone: userExists.phone,
            notes: userExists.notes,
            age: userExists.age,
            address: userExists.address,
            imageUrl: userExists.imageUrl,
          },
          code: "USER_EXISTS"
        });
      }

      const hashedPassword = await User.encryptPassword(password);

      let imageUrl = null;
      let imagePublicId = null;

      // Si hay una imagen, subirla a Cloudinary
      if (req.file) {
        try {
          console.log(`🖼️ Subiendo imagen para ${normalizedEmail}...`);
          const uploadResult = await uploadImageToCloudinary(
            req.file.path,
            `user_${Date.now()}_${req.file.originalname}`
          );
          
          imageUrl = uploadResult.imageUrl;
          imagePublicId = uploadResult.fileId;

          console.log(`✅ Imagen subida exitosamente: ${uploadResult.fileId}`);

          // Limpiar archivo temporal
          cleanupTempFile(req.file.path);
        } catch (uploadError) {
          console.error('❌ Error subiendo imagen:', uploadError);
          // Limpiar archivo temporal
          cleanupTempFile(req.file.path);
          // Continuar sin imagen si hay error
        }
      }

      // 🆕 CREAR USUARIO NUEVO
      console.log(`🆕 Creando nuevo usuario: ${normalizedEmail}`);
      const newUser = new User({
        name: name.trim(),
        email: normalizedEmail, // Usar email normalizado
        password: hashedPassword,
        phone: phone || '',
        notes: notes || '',
        age: age ? parseInt(age) : null,
        address: address || '',
        imageUrl,
        imagePublicId
      });

      const savedUser = await newUser.save();

      const token = jwt.sign({ id: savedUser._id }, config.SECRET, {
        expiresIn: 86400,
      });

      console.log(`✅ Usuario creado exitosamente: ${savedUser._id}`);

      res.status(201).json({
        message: "Usuario registrado con éxito",
        token,
        user: {
          _id: savedUser._id,
          name: savedUser.name,
          email: savedUser.email,
          phone: savedUser.phone,
          notes: savedUser.notes,
          age: savedUser.age,
          address: savedUser.address,
          imageUrl: savedUser.imageUrl,
        },
      });

    } catch (error) {
      // 🔧 MANEJO ESPECÍFICO DE ERROR DE EMAIL DUPLICADO
      if (error.code === 11000 && error.keyPattern?.email) {
        console.log(`📋 Error de duplicado detectado para: ${normalizedEmail}`);
        
        // Limpiar archivo temporal
        if (req.file) {
          cleanupTempFile(req.file.path);
        }
        
        try {
          // Buscar el usuario existente y retornar sus datos
          const existingUser = await User.findOne({ email: normalizedEmail });
          
          if (existingUser) {
            console.log(`✅ Usuario duplicado encontrado: ${existingUser._id}`);
            
            const token = jwt.sign({ id: existingUser._id }, config.SECRET, {
              expiresIn: 86400,
            });

            return res.status(200).json({
              message: "Usuario ya registrado, iniciando sesión",
              token,
              user: {
                _id: existingUser._id,
                name: existingUser.name,
                email: existingUser.email,
                phone: existingUser.phone,
                notes: existingUser.notes,
                age: existingUser.age,
                address: existingUser.address,
                imageUrl: existingUser.imageUrl,
              },
              code: "DUPLICATE_HANDLED"
            });
          }
        } catch (findError) {
          console.error(`❌ Error buscando usuario duplicado: ${findError.message}`);
        }
        
        return res.status(409).json({ 
          message: "El email ya está registrado",
          code: "EMAIL_DUPLICATE"
        });
      }
      
      // Error genérico
      throw error;
    }

  } catch (error) {
    // Limpiar archivo temporal si existe
    if (req.file) {
      cleanupTempFile(req.file.path);
    }
    
    console.error('❌ Error en signup:', error);
    res.status(500).json({ 
      message: "Hubo un error en el servidor", 
      error: error.message 
    });
  } finally {
    // 🆕 ALWAYS REMOVE FROM PROCESSING SET
    if (req.body.email) {
      const normalizedEmail = req.body.email.toLowerCase().trim();
      processingEmails.delete(normalizedEmail);
      console.log(`🧹 Email removido del procesamiento: ${normalizedEmail}`);
    }
  }
};
























export const getAllUsers = async (req, res) => {
  try {
    // 🔧 FILTRAR USUARIOS NO ELIMINADOS SOLAMENTE
    const users = await User.find({ 
      $or: [
        { isDeleted: { $exists: false } }, // Usuarios sin campo isDeleted (datos antiguos)
        { isDeleted: false }               // Usuarios con isDeleted = false
      ]
    }).select('-password');
    
    console.log(`📋 Obteniendo usuarios activos: ${users.length} encontrados`);
    
    res.status(200).json(users);
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({ message: "Error al obtener los usuarios" });
  }
};

// 🆕 NUEVO: Endpoint para verificar estado de la DB (AGREGAR ESTE)
export const getDbStatus = async (req, res) => {
  try {
    const activeUsers = await User.countDocuments({ 
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false }
      ]
    });
    
    const deletedUsers = await User.countDocuments({ isDeleted: true });
    const totalUsers = await User.countDocuments();
    
    console.log(`📊 Estado DB: ${activeUsers} activos, ${deletedUsers} eliminados, ${totalUsers} total`);
    
    res.status(200).json({
      activeUsers,
      deletedUsers,
      totalUsers,
      serverTime: new Date().toISOString(),
      dbStatus: 'connected'
    });
  } catch (error) {
    console.error('❌ Error obteniendo estado DB:', error);
    res.status(500).json({ message: "Error obteniendo estado de base de datos" });
  }
};

// 🆕 NUEVO: Endpoint para ver usuarios eliminados (AGREGAR ESTE)
export const getDeletedUsers = async (req, res) => {
  try {
    const deletedUsers = await User.find({ 
      isDeleted: true 
    }).select('-password');
    
    console.log(`🗑️ Usuarios eliminados: ${deletedUsers.length} encontrados`);
    
    res.status(200).json({
      message: "Usuarios eliminados obtenidos",
      count: deletedUsers.length,
      users: deletedUsers
    });
  } catch (error) {
    console.error('❌ Error obteniendo usuarios eliminados:', error);
    res.status(500).json({ message: "Error al obtener usuarios eliminados" });
  }
};


export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, phone, address, age, notes } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const updateData = { name, email, phone, address, age, notes };

    if (password) {
      updateData.password = await User.encryptPassword(password);
    }

    // Si hay nueva imagen
    if (req.file) {
      try {
        // Eliminar imagen anterior si existe
        if (user.imagePublicId) { // ← Cambio: imageFileId -> imagePublicId
          console.log(`Attempting to delete previous image: ${user.imagePublicId}`);
          
          const deleteResult = await deleteImageFromCloudinary(user.imagePublicId);
          
          if (deleteResult.success) {
            if (deleteResult.deleted) {
              console.log('Previous image deleted successfully');
            } else if (deleteResult.notFound) {
              console.log('Previous image was already deleted or not found');
            } else if (deleteResult.skipped) {
              console.log('No previous image to delete');
            }
          } else {
            console.warn(`Warning: Could not delete previous image: ${deleteResult.message}`);
          }
        }

        // Subir nueva imagen a Cloudinary
        console.log('Uploading new image to Cloudinary...');
        const uploadResult = await uploadImageToCloudinary(
          req.file.path,
          `user_${id}_${Date.now()}_${req.file.originalname}`
        );

        updateData.imageUrl = uploadResult.imageUrl;
        updateData.imagePublicId = uploadResult.fileId; // ← Cambio: imageFileId -> imagePublicId

        console.log(`New image uploaded successfully: ${uploadResult.fileId}`);

        // Limpiar archivo temporal
        cleanupTempFile(req.file.path);

      } catch (uploadError) {
        console.error('Error uploading image to Cloudinary:', uploadError);
        
        // Limpiar archivo temporal en caso de error
        cleanupTempFile(req.file.path);
        
        return res.status(500).json({ 
          message: "Error al subir la imagen", 
          error: uploadError.message 
        });
      }
    }

    // Actualizar usuario en la base de datos
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select('-password');

    console.log(`User ${id} updated successfully`);

    res.status(200).json({
      message: "Usuario actualizado",
      user: updatedUser,
    });

  } catch (error) {
    // Limpiar archivo temporal en caso de error general
    if (req.file) {
      cleanupTempFile(req.file.path);
    }
    
    console.error('Error updating user:', error);
    res.status(500).json({ 
      message: "Error al actualizar usuario",
      error: error.message 
    });
  }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: "ID de usuario inválido" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Eliminar imagen de Cloudinary si existe
        if (user.imagePublicId) {
            try {
                console.log(`Deleting image for user deletion: ${user.imagePublicId}`);
                const deleteResult = await deleteImageFromCloudinary(user.imagePublicId);
                
                if (deleteResult.success) {
                    console.log('User image deleted successfully');
                } else {
                    console.warn(`Warning: Could not delete user image: ${deleteResult.message}`);
                }
            } catch (error) {
                console.error('Error deleting image from Cloudinary:', error);
            }
        }

        // 🔄 CAMBIO: Usar soft delete en lugar de eliminación física
        const deletedUser = await user.softDelete().save();

        res.status(200).json({
            message: "Usuario eliminado con éxito",
            deletedUserId: id,
            syncVersion: deletedUser.syncVersion,
            lastModified: deletedUser.lastModified
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al eliminar el usuario", error });
    }
};


