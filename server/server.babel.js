// All subsequent files required by node with the extensions .es6, .es, .jsx and .js will be transformed by Babel.
require('babel-register');

// Server Driver Code, everything from here on can use all the super future ES6 features!
module.exports = require('./server.js');
// module.exports = function() {
//   console.log(process.env.NODE_ENV);
//   return require(`./server.${process.env.NODE_ENV}.js`);
// };
