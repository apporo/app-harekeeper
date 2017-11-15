'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx =  Devebot.require('debug')('appHarekeeper:trigger');
var opflow = require('opflow');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  var recyclerCfg = lodash.get(params, ['sandboxConfig', 'recycler'], {});
  var recycler = {};
  
  lodash.forOwn(recyclerCfg, function(config, name) {
    if (lodash.isObject(config) && !lodash.isEmpty(config) && config.enabled !== false) {
      LX.isEnabledFor('debug') && LX.log('debug', LT.add({
        message: 'Register a recycler handler',
        recyclerName: name
      }).toMessage({reset: true}));
      recycler[name] = new opflow.Recycler(config);
    }
  });

  Object.defineProperty(self, 'recycler', {
    get: function() {
      LX.isEnabledFor('debug') && LX.log('debug', LT.add({
        message: 'Get recyclerList',
        recyclerNames: lodash.keys(recycler)
      }).toMessage());
      return lodash.clone(recycler);
    },
    set: function(val) {}
  });

  self.start = function() {
    return Promise.mapSeries(lodash.values(recycler), function(rpc) {
      return rpc.ready();
    });
  };

  self.stop = function() {
    return Promise.mapSeries(lodash.values(recycler), function(rpc) {
      return rpc.close();
    });
  };

  debugx.enabled && debugx(' - constructor end!');
};

module.exports = Service;
