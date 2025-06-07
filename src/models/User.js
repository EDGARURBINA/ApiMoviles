import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    type: String,
  }, 
  notes: {
    type: String,
  }, 
  phone: {
    type: String,
  },
  age: {
    type: Number, 
  },
  password: {
    type: String,
    required: true,
  },
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
