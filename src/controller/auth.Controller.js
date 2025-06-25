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
    const { name, email, password, phone, notes, age, address } = req.body;

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
      name,
      email,
      password: hashedPassword,
      phone,
      notes,
      age,
      address,
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
          await deleteImageFromDrive(user.imageFileId);
        }

        // Subir nueva imagen
        const uploadResult = await uploadImageToDrive(
          req.file.path,
          `user_${id}_${Date.now()}_${req.file.originalname}`,
          req.file.mimetype
        );

        updateData.imageUrl = uploadResult.imageUrl;
        updateData.imageFileId = uploadResult.fileId;

        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select('-password');

    res.status(200).json({
      message: "Usuario actualizado",
      user: updatedUser,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error(error);
    res.status(500).json({ message: "Error al actualizar usuario" });
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
