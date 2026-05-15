const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'db',
  user: 'gameuser',     //  root
  password: 'gamepass', // ..
  database: 'gameclub'
});


connection.connect(err => {
  if (err) {
    console.log('❌ Ошибка подключения:', err);
  } else {
    console.log('✅ MySQL подключен');
  }
});

module.exports = connection;