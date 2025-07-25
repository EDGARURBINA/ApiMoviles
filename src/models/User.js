import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  address: {
    type: String,
    default: '',
  }, 
  notes: {
    type: String,
    default: '',
  }, 
  phone: {
    type: String,
    default: '',
  },
  age: {
    type: Number,
    min: [1, 'La edad debe ser mayor a 0'],
    max: [120, 'La edad debe ser menor a 120'],
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
  },
  imageUrl: {
    type: String,
    default: null,
  },
  imagePublicId: {
    type: String,
    default: null,
  },
  // 🔄 ELIMINADO: imageFileId (duplicado con imagePublicId)
  
  // 🆕 NUEVOS CAMPOS PARA SINCRONIZACIÓN
  lastModified: {
    type: Date,
    default: Date.now,
    index: true, // Para consultas rápidas de sincronización
  },
  syncVersion: {
    type: Number,
    default: 1,
    min: 1,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true, // Para excluir eliminados fácilmente
  },
  clientId: {
    type: String,
    default: null, // ID temporal del cliente para mapear durante sync
    sparse: true, // Permite múltiples valores null
  },
  
  roles: [{
    type: Schema.Types.ObjectId,
    ref: 'Role',
  }],
}, { 
  timestamps: true, // ✅ MANTENER - da createdAt y updatedAt
  // 🆕 NUEVO: Optimización para sincronización
  toJSON: {
    transform: function(doc, ret) {
      // No enviar campos sensibles al cliente
      delete ret.password;
      return ret;
    }
  }
});

// ✅ MANTENER métodos existentes
userSchema.statics.encryptPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

userSchema.statics.comparePassword = async function (password, receivedPassword) {
  return bcrypt.compare(password, receivedPassword);
};

// 🆕 NUEVOS MÉTODOS para sincronización
userSchema.methods.updateLastModified = function() {
  this.lastModified = new Date();
  this.syncVersion += 1;
  return this;
};

userSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.lastModified = new Date();
  this.syncVersion += 1;
  return this;
};

userSchema.methods.restore = function() {
  this.isDeleted = false;
  this.lastModified = new Date();
  this.syncVersion += 1;
  return this;
};

// 🆕 MIDDLEWARES para auto-actualizar lastModified
userSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModified = new Date();
    if (!this.isModified('syncVersion')) {
      this.syncVersion += 1;
    }
  }
  next();
});

userSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ 
    lastModified: new Date(),
    $inc: { syncVersion: 1 }
  });
  next();
});

// 🆕 ÍNDICES para optimizar consultas de sincronización
userSchema.index({ lastModified: -1 }); // Para obtener cambios recientes
userSchema.index({ isDeleted: 1, lastModified: -1 }); // Para sync de activos
userSchema.index({ syncVersion: -1 }); // Para versionado
userSchema.index({ clientId: 1 }, { sparse: true }); // Para mapear clientes temporales

// 🆕 MÉTODOS ESTÁTICOS para sincronización
userSchema.statics.findModifiedSince = function(timestamp) {
  return this.find({
    lastModified: { $gte: new Date(timestamp) },
    isDeleted: false
  }).sort({ lastModified: 1 });
};

userSchema.statics.findDeletedSince = function(timestamp) {
  return this.find({
    lastModified: { $gte: new Date(timestamp) },
    isDeleted: true
  }).sort({ lastModified: 1 });
};

userSchema.statics.findByClientId = function(clientId) {
  return this.findOne({ clientId: clientId });
};

userSchema.statics.bulkSync = async function(operations) {
  const results = [];
  
  for (const operation of operations) {
    try {
      let result;
      
      switch (operation.type) {
        case 'CREATE':
          result = await this.create({
            ...operation.data,
            lastModified: new Date(),
            syncVersion: 1
          });
          break;
          
        case 'UPDATE':
          result = await this.findByIdAndUpdate(
            operation.id,
            {
              ...operation.data,
              lastModified: new Date(),
              $inc: { syncVersion: 1 }
            },
            { new: true }
          );
          break;
          
        case 'DELETE':
          result = await this.findByIdAndUpdate(
            operation.id,
            {
              isDeleted: true,
              lastModified: new Date(),
              $inc: { syncVersion: 1 }
            },
            { new: true }
          );
          break;
          
        default:
          throw new Error(`Operación no válida: ${operation.type}`);
      }
      
      results.push({
        operationId: operation.operationId,
        success: true,
        data: result,
        syncVersion: result?.syncVersion
      });
      
    } catch (error) {
      results.push({
        operationId: operation.operationId,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
};

const User = model('User', userSchema);
export default User;