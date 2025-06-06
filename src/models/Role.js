import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const roleSchema = new Schema({
  name: {
    type: String,
    enum: ['Trabajador', 'Admin'],
    required: true,
    unique: true
  },
});

const Role = model('Role', roleSchema);

export default Role;
