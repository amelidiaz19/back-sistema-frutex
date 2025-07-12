const mysql = require('mysql2/promise');

const db2 = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'ru19', 
  database: 'frutex',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


module.exports = { db2 };
