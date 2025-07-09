import jwt from 'jsonwebtoken';
import config from '../config.js'; 
import User from '../models/User.js';
import Role from '../models/Role.js';
import { uploadImageToDrive, deleteImageFromDrive } from '../services/googleDriveService.js';
import fs from 'fs';

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
    // Cuando usamos multipart/form-data, los datos vienen en req.body pero pueden necesitar procesamiento
    const { name, email, password, phone, notes, age, address } = req.body;
    
    // Debug: ver qué está llegando
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);
    
    // Validación manual ya que los datos vienen como string desde form-data
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: "Los campos name, email y password son obligatorios" 
      });
    }

    // Verifica si el usuario ya existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "El correo electrónico ya está registrado" });
    }

    // Encriptar la contraseña
    const hashedPassword = await User.encryptPassword(password);

    let imageUrl = null;
    let imageFileId = null;

    // Si hay una imagen, subirla a Google Drive
    if (req.file) {
      try {
        const uploadResult = await uploadImageToDrive(
          req.file.path,
          `user_${Date.now()}_${req.file.originalname}`,
          req.file.mimetype
        );
        
        imageUrl = uploadResult.imageUrl;
        imageFileId = uploadResult.fileId;

        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
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
      imageFileId
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
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error(error);
    res.status(500).json({ message: "Hubo un error en el servidor", error });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password'); // No incluir contraseñas
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
        if (user.imageFileId) {
          console.log(`Attempting to delete previous image: ${user.imageFileId}`);
          
          const deleteResult = await deleteImageFromDrive(user.imageFileId);
          
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
            // NO fallar la operación, solo advertir
          }
        }

        // Subir nueva imagen
        console.log('Uploading new image...');
        const uploadResult = await uploadImageToDrive(
          req.file.path,
          `user_${id}_${Date.now()}_${req.file.originalname}`,
          req.file.mimetype
        );

        updateData.imageUrl = uploadResult.imageUrl;
        updateData.imageFileId = uploadResult.fileId;

        console.log(`New image uploaded successfully: ${uploadResult.fileId}`);

        // Eliminar archivo temporal
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        
        // Limpiar archivo temporal en caso de error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
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
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
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

        // Eliminar imagen de Google Drive si existe
        if (user.imageFileId) {
            try {
                await deleteImageFromDrive(user.imageFileId);
            } catch (error) {
                console.error('Error deleting image from Drive:', error);
            }
        }

        await User.findByIdAndDelete(id);

        res.status(200).json({
            message: "Usuario eliminado con éxito",
            deletedUserId: id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al eliminar el usuario", error });
    }
};
