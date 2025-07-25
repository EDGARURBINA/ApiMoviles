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

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, phone, notes, age, address } = req.body;
    
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);
    
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: "Los campos name, email y password son obligatorios" 
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "El correo electrónico ya está registrado" });
    }

    const hashedPassword = await User.encryptPassword(password);

    let imageUrl = null;
    let imagePublicId = null; // ← Cambio: imageFileId -> imagePublicId

    // Si hay una imagen, subirla a Cloudinary
    if (req.file) {
      try {
        console.log('Uploading image to Cloudinary...');
        const uploadResult = await uploadImageToCloudinary(
          req.file.path,
          `user_${Date.now()}_${req.file.originalname}`
        );
        
        imageUrl = uploadResult.imageUrl;
        imagePublicId = uploadResult.fileId; // ← Cambio: imageFileId -> imagePublicId

        console.log(`Image uploaded successfully: ${uploadResult.fileId}`);

        // Limpiar archivo temporal
        cleanupTempFile(req.file.path);
      } catch (uploadError) {
        console.error('Error uploading image to Cloudinary:', uploadError);
        // Limpiar archivo temporal
        cleanupTempFile(req.file.path);
        // Continuar sin imagen si hay error
      }
    }

    // Crear nuevo usuario
    const newUser = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      phone: phone || '',
      notes: notes || '',
      age: age ? parseInt(age) : null,
      address: address || '',
      imageUrl,
      imagePublicId // ← Cambio: imageFileId -> imagePublicId
    });

    const savedUser = await newUser.save();

    const token = jwt.sign({ id: savedUser._id }, config.SECRET, {
      expiresIn: 86400,
    });

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
    // Limpiar archivo temporal si existe
    if (req.file) {
      cleanupTempFile(req.file.path);
    }
    console.error(error);
    res.status(500).json({ message: "Hubo un error en el servidor", error });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los usuarios" });
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


