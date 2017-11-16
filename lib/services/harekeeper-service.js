'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('debug')('appHarekeeper:service');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  var recyclebins = {};
  var recyclerHandlers = params.harekeeperTrigger.recycler;

  var assertRecycler = function(recyclerName) {
    var recycler = recyclerHandlers[recyclerName];
    if (!recycler) return Promise.reject({
      message: 'Recyclebin not found',
      recyclebin: reecyclerName
    });
    return Promise.resolve(recycler);
  }

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  var contextPath = pluginCfg.contextPath || '/harekeeper';

  var express = params.webweaverService.express;
  var router = express.Router();

  router.route('/').get(function(req, res, next) {
    res.json(lodash.map(lodash.keys(recyclerHandlers), function(name) {
      return { name: name };
    }));
  });

  router.route('/:recyclebin').get(function(req, res, next) {
    debugx.enabled && debugx(' - GET [%s]', req.url);
    LX.isEnabledFor('debug') && LX.log('debug', LT.add({
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
      LX.isEnabledFor('debug') && LX.log('debug', LT.add({
        message: 'Get recyclebin information - DONE',
        recyclebin: req.params.recyclebin
      }).toMessage());
    });
  });

  var topMsgRoute = router.route('/:recyclebin/top');

  topMsgRoute.get(function(req, res, next) {
    var binName = req.params.recyclebin;
    LX.isEnabledFor('debug') && LX.log('debug', LT.add({
      message: 'Load top message',
      recyclebin: binName
    }).toMessage());
    assertRecycler(binName).then(function(recycler) {
      recyclebins[binName] = recyclebins[binName] || {};
      return recycler.examine(function(msg, update) {
        // store basic information
        recyclebins[binName].updater = update;
        recyclebins[binName].message = msg;
        // extract more data
        recyclebins[binName].headers = msg.properties;
        try {
          recyclebins[binName].content = JSON.parse(msg.content.toString());
          recyclebins[binName].contentType = 'json';
        } catch (error) {
          recyclebins[binName].content = msg.content.toString();
          recyclebins[binName].contentType = 'text';
        }
        // logging information
        debugx.enabled && debugx('contentType: %s', recyclebins[binName].contentType);
      });
    }).then(function(info) {
      var result = lodash.assign({}, info, 
          lodash.pick(recyclebins[binName], ["content", "contentType"]));
      debugx.enabled && debugx(' - examine() result: %s', JSON.stringify(result));
      res.json(result);
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.isEnabledFor('debug') && LX.log('debug', LT.add({
        message: 'Load top message - DONE',
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
