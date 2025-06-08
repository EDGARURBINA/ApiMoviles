
import jwt from 'jsonwebtoken';
import config from '../config.js'; 
import User from '../models/User.js';
import Role from '../models/Role.js';

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
            expiresIn: 86400, // 24 horas
        });

        res.status(200).json({
            message: "Inicio de sesión exitoso",
            token,
            user: {
                id: userFound._id,
                name: userFound.name,
                email: userFound.email,
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

    // Crear nuevo usuario sin roles
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      notes,
      age,
      address
    });

    const savedUser = await newUser.save();

    // Crear token JWT con el id del usuario
    const token = jwt.sign({ id: savedUser._id }, config.SECRET, {
      expiresIn: 86400, // 24 horas
    });

    // Responder con éxito y datos del usuario
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
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Hubo un error en el servidor", error });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
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

    // Validar ID
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    // Preparar datos a actualizar
    const updateData = { name, email, phone, address, age, notes };

    // Si se envía una nueva contraseña, encriptarla
    if (password) {
      updateData.password = await User.encryptPassword(password);
    }

    // Actualizar usuario
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      message: "Usuario actualizado",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar usuario" });
  }
};






// Función para eliminar un usuario
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Validar que el ID sea válido
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: "ID de usuario inválido" });
        }

        // Verificar que el usuario existe
        const userExists = await User.findById(id);
        if (!userExists) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Eliminar el usuario
        await User.findByIdAndDelete(id);

        console.log("Usuario eliminado con éxito:", id);

        res.status(200).json({
            message: "Usuario eliminado con éxito",
            deletedUserId: id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al eliminar el usuario", error });
    }
};




