'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('app-harekeeper:trigger');
var opflow = require('opflow');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  var recyclerCfg = lodash.get(params, ['sandboxConfig', 'recycler'], {});
  var recyclerStore = {};
  
  lodash.forOwn(recyclerCfg, function(config, name) {
    if (lodash.isObject(config) && !lodash.isEmpty(config) && config.enabled !== false) {
      LX.has('debug') && LX.log('debug', LT.add({
        message: 'Register a recycler handler',
        recyclerName: name
      }).toMessage({reset: true}));
      recyclerStore[name] = {
        name: name,
        description: lodash.get(config, ['__metadata', 'description']),
        handler: new opflow.Recycler(config)
      }
    }
  });

  Object.defineProperty(self, 'recyclerStore', {
    get: function() {
      LX.has('debug') && LX.log('debug', LT.add({
        message: 'Get recyclerStore',
        recyclerNames: lodash.keys(recyclerStore)
      }).toMessage());
      return lodash.clone(recyclerStore);
    },
    set: function(val) {}
  });

  self.start = function() {
    return Promise.mapSeries(lodash.values(recyclerStore), function(rpc) {
      return rpc.handler.ready();
    });
  };

  self.stop = function() {
    return Promise.mapSeries(lodash.values(recyclerStore), function(rpc) {
      return rpc.handler.close();
    });
  };

  debugx.enabled && debugx(' - constructor end!');
};

module.exports = Service;
