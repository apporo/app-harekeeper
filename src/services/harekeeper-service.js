'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const path = require('path');
const util = require('util');

function HarekeeperService(params) {
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

  let harekeeperTrigger = params["harekeeperTrigger"];
  let webweaverService = params["app-webweaver/webweaverService"];

  let recyclerStore = harekeeperTrigger.recyclerStore;

  let assertRecycler = function(recyclerName) {
    let recycler = lodash.get(recyclerStore, [recyclerName, 'handler']);
    if (!recycler) return Promise.reject({
      message: 'Recyclebin not found',
      recyclebin: reecyclerName
    });
    return Promise.resolve(recycler);
  }

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let contextPath = pluginCfg.contextPath || '/harekeeper';
  let uniqueField = pluginCfg.idFieldName || 'requestId';
  let includedProperties = lodash.isArray(pluginCfg.includedProperties) ?
      pluginCfg.includedProperties : null;
  let excludedProperties = lodash.isArray(pluginCfg.excludedProperties) ?
      pluginCfg.excludedProperties : null;

  let express = webweaverService.express;
  let router = express.Router();

  router.route('/').get(function(req, res, next) {
    res.json(lodash.map(lodash.keys(recyclerStore), function(name) {
      let handlerInfo = lodash.omit(recyclerStore[name], ['handler']);
      return handlerInfo;
    }));
  });

  router.route('/:recyclebin').get(function(req, res, next) {
    LX.has('debug') && LX.log('debug', LT.add({
      url: req.url,
      recyclebin: req.params.recyclebin
    }).toMessage({
      text: 'Get recyclebin information, url: ${url}'
    }));
    assertRecycler(req.params.recyclebin).then(function(recycler) {
      return recycler.checkRecyclebin();
    }).then(function(info) {
      res.json(info);
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.has('debug') && LX.log('debug', LT.add({
        recyclebin: req.params.recyclebin
      }).toMessage({
        text: 'Get recyclebin information - DONE'
      }));
    });
  });

  let topMsgRoute = router.route('/:recyclebin/top');

  topMsgRoute.get(function(req, res, next) {
    let binName = req.params.recyclebin;
    let garbageMsg = {};
    LX.has('debug') && LX.log('debug', LT.add({
      recyclebin: binName
    }).toMessage({
      text: 'Load top message of "${recyclebin}"'
    }));
    assertRecycler(binName).then(function(recycler) {
      return recycler.examine(function(msg, update) {
        // extract more data
        garbageMsg.properties = msg.properties;
        if (includedProperties) {
          garbageMsg.properties = lodash.pick(garbageMsg.properties, includedProperties);
        }
        if (excludedProperties) {
          garbageMsg.properties = lodash.omit(garbageMsg.properties, excludedProperties);
        }
        try {
          garbageMsg.content = JSON.parse(msg.content.toString());
          garbageMsg.__format__ = 'json';
        } catch (error) {
          garbageMsg.content = msg.content.toString();
          garbageMsg.__format__ = 'text';
        }
        // logging information
        LX.has('silly') && LX.log('silly', LT.add({
          garbageFormat: garbageMsg.__format__
        }).toMessage({
          text: 'garbage format: ${garbageFormat}'
        }));
        update('restore');
      });
    }).then(function(output) {
      garbageMsg.__output__ = output;
      LX.has('debug') && LX.log('debug', LT.add({ output }).toMessage({
        text: ' - examine() output: ${output}'
      }));
      res.json(garbageMsg);
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.has('debug') && LX.log('debug', LT.add({
        recyclebin: binName
      }).toMessage({
        text: 'Load top message of "${recyclebin}" - DONE'
      }));
    });
  });

  topMsgRoute.put(function(req, res, next) {
    let payload = req.body || {};
    let newId = lodash.get(payload, ['properties', 'headers', uniqueField]);
    if (lodash.isEmpty(newId) && !payload.forced) {
      res.status(403).json({
        message: 'Invalid updating message object. ID field must not be empty',
        idFieldName: uniqueField
      });
      return;
    }

    let binName = req.params.recyclebin;
    LX.has('debug') && LX.log('debug', LT.add({
      recyclebin: binName
    }).toMessage({
      text: 'Save top message of "${recyclebin}"'
    }));

    let updatingFailed = null;
    assertRecycler(binName).then(function(recycler) {
      return recycler.examine(function(msg, update) {
        let oldId = lodash.get(msg, ['properties', 'headers', uniqueField]);
        if (oldId == newId || (lodash.isEmpty(oldId) && payload.forced)) {
          let newPayload = {
            properties: payload.properties,
            content: payload.content
          }
          if (includedProperties) {
            newPayload.properties = lodash.pick(newPayload.properties, includedProperties);
          }
          if (excludedProperties) {
            newPayload.properties = lodash.omit(newPayload.properties, excludedProperties);
          }
          update(payload.action, newPayload);
        } else {
          updatingFailed = {
            message: 'message objects are mismatched',
            oldId: oldId,
            newId: newId,
            forced: payload.forced
          }
          update('restore');
        }
      });
    }).then(function(info) {
      if (lodash.isEmpty(updatingFailed)) {
        let result = lodash.assign({}, info);
        LX.has('debug') && LX.log('debug', LT.add({ result }).toMessage({
          text: ' - examine() output: ${result}'
        }));
        res.json(result);
      } else {
        res.status(400).json(updatingFailed);
      }
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.has('debug') && LX.log('debug', LT.add({
        recyclebin: binName
      }).toMessage({
        text: 'Save top message of "${recyclebin}" - DONE'
      }));
    });
  });

  self.getRestRouterLayer = function() {
    return {
      name: 'app-harekeeper-rest',
      path: contextPath,
      middleware: router
    }
  }

  webweaverService.push([
    webweaverService.getDefaultRedirectLayer(),
    webweaverService.getJsonBodyParserLayer(),
    self.getRestRouterLayer()
  ], pluginCfg.priority);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

HarekeeperService.referenceList = [
  "harekeeperTrigger",
  "app-webweaver/webweaverService"
];

module.exports = HarekeeperService;
