import dotenv from 'dotenv';
import app from './app.js';
import mongoose from 'mongoose';
import { createRoles } from './libs/inicialSetup.js';
import logSymbols from 'log-symbols';
import chalk from 'chalk';
dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error(`${logSymbols.error} MONGO_URI no está definida en el archivo .env`);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(chalk.green( `${logSymbols.success}  Conectado a MongoDB`));

    
    await createRoles();
 
   app.listen(PORT, '0.0.0.0', () => {
  console.log(chalk.green `${logSymbols.success} 🚀 Servidor corriendo en el puerto ${PORT}`);
});
  })
  .catch((error) => {
    console.error(logSymbols.error, 'Error al conectar a MongoDB:', error); 
  });

  