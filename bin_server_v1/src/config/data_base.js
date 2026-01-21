const { Sequelize } = require('sequelize');
const logger = require('./logger');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PAS,
    {
        dialect: 'postgres',
        host: process.env.HOST_BD,  
        port: process.env.DB_PORT,
        logging: process.env.DB_LOGGING === 'true' ? (msg) => logger.debug(msg) : false
    }
);

module.exports = sequelize;
