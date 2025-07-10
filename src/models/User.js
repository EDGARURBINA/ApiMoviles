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
  imageFileId: {
    type: String,
    default: null,
  },
  roles: [{
    type: Schema.Types.ObjectId,
    ref: 'Role',
  }],
}, { timestamps: true });

userSchema.statics.encryptPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

userSchema.statics.comparePassword = async function (password, receivedPassword) {
  return bcrypt.compare(password, receivedPassword);
};

const User = model('User', userSchema);
export default User;