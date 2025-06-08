
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
    const users = await User.find().populate("roles", "name"); 
    
    // Formatear la respuesta para que sea consistente
    const formattedUsers = users.map(user => ({
      id: user._id.toString(), // Convertir _id a string
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      address: user.address || "",
      age: user.age || 0,
      notes: user.notes || "",
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    console.log("Usuarios formateados:", formattedUsers); // LOG PARA DEBUG
    console.log("Primer usuario ID:", formattedUsers[0]?.id); // LOG PARA DEBUG
    
    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los usuarios", error });
  }
};


export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, roles, phone, address, age, notes } = req.body;

        // Validar que el ID sea válido
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: "ID de usuario inválido" });
        }

        // Verificar que el usuario existe
        const userExists = await User.findById(id);
        if (!userExists) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Verificar si el email ya está en uso por otro usuario
        if (email && email !== userExists.email) {
            const emailExists = await User.findOne({ email, _id: { $ne: id } });
            if (emailExists) {
                return res.status(400).json({ message: "El correo electrónico ya está registrado por otro usuario" });
            }
        }

        // Preparar los datos a actualizar
        const updateData = {};
        
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone; // Permitir valores vacíos
        if (address !== undefined) updateData.address = address; // Nuevo campo
        if (age !== undefined) updateData.age = age; // Nuevo campo
        if (notes !== undefined) updateData.notes = notes; // Nuevo campo
        if (address !== undefined) updateData.address = address; // Nuevo campo
        if (age !== undefined) updateData.age = age; // Nuevo campo
        if (notes !== undefined) updateData.notes = notes; // Nuevo campo

        // Si se proporciona una nueva contraseña, encriptarla
        if (password) {
            updateData.password = await User.encryptPassword(password);
        }

        // Manejar actualización de roles SOLO si se envían en la petición
        if (roles !== undefined) {
            let userRole = roles;
            
            // Normalizar el rol
            if (typeof roles === 'string') {
                userRole = roles.trim();
            }

            // Validar que el rol sea válido
            if (userRole !== "Admin" && userRole !== "Trabajador") {
                return res.status(400).json({ message: "Rol inválido. Debe ser 'Admin' o 'Trabajador'" });
            }

            // Buscar el rol en la base de datos
            const roleExists = await Role.findOne({ name: userRole });
            if (!roleExists) {
                return res.status(400).json({ message: `El rol ${userRole} no existe` });
            }

            updateData.roles = [roleExists._id];
        }
        // Si no se envían roles, se mantienen los existentes (no se actualiza el campo)

        // Actualizar el usuario
        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate("roles", "name");

        console.log("Usuario actualizado con éxito:", updatedUser);

        res.status(200).json({
            message: "Usuario actualizado con éxito",
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                address: updatedUser.address, // Nuevo campo en respuesta
                age: updatedUser.age, // Nuevo campo en respuesta
                notes: updatedUser.notes, // Nuevo campo en respuesta
                roles: updatedUser.roles,
                updatedAt: updatedUser.updatedAt
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar el usuario", error });
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




