
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
        const { name, email, password, roles, phone , notes, age} = req.body;

        console.log("Rol recibido:", roles);
        console.log("Tipo de dato del rol:", typeof roles);

        const userExists = await User.findOne({ email });
        if (userExists) {
            res.status(400).json({ message: "El correo electrónico ya está registrado" });
            return;
        }

        const hashedPassword = await User.encryptPassword(password);

        let userRole = "Trabajador";

        if (roles) {
            const normalizedRole = typeof roles === 'string' ? roles.trim() : '';
            if (normalizedRole === "Admin" || normalizedRole === "Trabajador") {
                userRole = normalizedRole;
            }
        }

        console.log("Rol que se buscará en la BD:", userRole);

        const roleExists = await Role.findOne({ name: userRole });
        if (!roleExists) {
            res.status(400).json({ message: `El rol ${userRole} no existe` });
            return;
        }

        console.log("ID del rol encontrado:", roleExists._id);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone, 
            roles: [roleExists._id],
            notes,
            age,
            address
        });

        const savedUser = await newUser.save();
        console.log("Usuario creado con éxito:", savedUser);

        const token = jwt.sign({ id: savedUser._id }, config.SECRET, {
            expiresIn: 86400, // 24 horas
        });

        res.status(201).json({
            message: "Usuario registrado con éxito",
            token,
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email,
                roles: savedUser.roles,
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
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los usuarios", error });
  }
};




// Función para actualizar un usuario
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, roles, phone } = req.body;

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
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
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




