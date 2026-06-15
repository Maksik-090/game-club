const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'db',
  user: 'gameuser',     
  password: 'gamepass', 
  database: 'gameclub'
});


connection.connect(err => {
  if (err) {
    console.log('X Ошибка подключения:', err);
  } else {
    console.log('YYY MySQL подключен');
  }
});

module.exports = connection;