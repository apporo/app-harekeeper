'use strict';

var path = require('path');

var app = require('devebot').launchApplication({
  appRootPath: __dirname
}, [
  'app-jsoneditor',
  {
    name: 'app-harekeeper',
    path: path.join(__dirname, '../../index.js')
  }
]);

if (require.main === module) app.server.start();

module.exports = app;
