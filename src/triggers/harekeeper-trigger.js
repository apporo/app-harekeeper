'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const opflow = require('opflow');

function HarekeeperTrigger(params) {
  params = params || {};

  let self = this;
  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-harekeeper';
  let blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let recyclerCfg = lodash.get(params, ['sandboxConfig', 'recycler'], {});
  let recyclerStore = {};
  
  lodash.forOwn(recyclerCfg, function(config, name) {
    if (lodash.isObject(config) && !lodash.isEmpty(config) && config.enabled !== false) {
      LX.has('debug') && LX.log('debug', LT.add({ name }).toMessage({
        text: 'Register a recycler: ${name}'
      }));
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
        recyclerNames: lodash.keys(recyclerStore)
      }).toMessage({
        text: 'Get recyclerStore collection (${recyclerNames})'
      }));
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

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

module.exports = HarekeeperTrigger;
