'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('app-harekeeper:service');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  var recyclerStore = params.harekeeperTrigger.recyclerStore;

  var assertRecycler = function(recyclerName) {
    var recycler = lodash.get(recyclerStore, [recyclerName, 'handler']);
    if (!recycler) return Promise.reject({
      message: 'Recyclebin not found',
      recyclebin: reecyclerName
    });
    return Promise.resolve(recycler);
  }

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  var contextPath = pluginCfg.contextPath || '/harekeeper';
  var uniqueField = pluginCfg.idFieldName || 'requestId';
  var includedProperties = lodash.isArray(pluginCfg.includedProperties) ?
      pluginCfg.includedProperties : null;
  var excludedProperties = lodash.isArray(pluginCfg.excludedProperties) ?
      pluginCfg.excludedProperties : null;

  var express = params.webweaverService.express;
  var router = express.Router();

  router.route('/').get(function(req, res, next) {
    res.json(lodash.map(lodash.keys(recyclerStore), function(name) {
      var handlerInfo = lodash.omit(recyclerStore[name], ['handler']);
      return handlerInfo;
    }));
  });

  router.route('/:recyclebin').get(function(req, res, next) {
    debugx.enabled && debugx(' - GET [%s]', req.url);
    LX.has('debug') && LX.log('debug', LT.add({
      message: 'Get recyclebin information',
      recyclebin: req.params.recyclebin
    }).toMessage());
    assertRecycler(req.params.recyclebin).then(function(recycler) {
      return recycler.checkRecyclebin();
    }).then(function(info) {
      res.json(info);
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.has('debug') && LX.log('debug', LT.add({
        message: 'Get recyclebin information - DONE',
        recyclebin: req.params.recyclebin
      }).toMessage());
    });
  });

  var topMsgRoute = router.route('/:recyclebin/top');

  topMsgRoute.get(function(req, res, next) {
    var binName = req.params.recyclebin;
    var garbageMsg = {};
    LX.has('debug') && LX.log('debug', LT.add({
      message: 'Load top message',
      recyclebin: binName
    }).toMessage());
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
        debugx.enabled && debugx('contentType: %s', garbageMsg.__format__);
        update('restore');
      });
    }).then(function(output) {
      garbageMsg.__output__ = output;
      debugx.enabled && debugx(' - examine() output: %s', JSON.stringify(output));
      res.json(garbageMsg);
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.has('debug') && LX.log('debug', LT.add({
        message: 'Load top message - DONE',
        recyclebin: binName
      }).toMessage());
    });
  });

  topMsgRoute.put(function(req, res, next) {
    var payload = req.body || {};
    var newId = lodash.get(payload, ['properties', 'headers', uniqueField]);
    if (lodash.isEmpty(newId) && !payload.forced) {
      res.status(403).json({
        message: 'Invalid updating message object. ID field must not be empty',
        idFieldName: uniqueField
      });
      return;
    }

    var binName = req.params.recyclebin;
    LX.has('debug') && LX.log('debug', LT.add({
      message: 'Save top message',
      recyclebin: binName
    }).toMessage());

    var updatingFailed = null;
    assertRecycler(binName).then(function(recycler) {
      return recycler.examine(function(msg, update) {
        var oldId = lodash.get(msg, ['properties', 'headers', uniqueField]);
        if (oldId == newId || (lodash.isEmpty(oldId) && payload.forced)) {
          var newPayload = {
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
        var result = lodash.assign({}, info);
        debugx.enabled && debugx(' - examine() result: %s', JSON.stringify(result));
        res.json(result);
      } else {
        res.status(400).json(updatingFailed);
      }
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.has('debug') && LX.log('debug', LT.add({
        message: 'Save top message - DONE',
        recyclebin: binName
      }).toMessage());
    });
  });

  self.getRestRouterLayer = function() {
    return {
      name: 'app-harekeeper-rest',
      path: contextPath,
      middleware: router
    }
  }

  params.webweaverService.push([
    params.webweaverService.getDefaultRedirectLayer(),
    params.webweaverService.getJsonBodyParserLayer(),
    self.getRestRouterLayer()
  ], pluginCfg.priority);

  debugx.enabled && debugx(' - constructor end!');
};

Service.referenceList = [ "webweaverService", "harekeeperTrigger" ];

module.exports = Service;