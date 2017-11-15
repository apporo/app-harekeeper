'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('debug')('appHarekeeper:service');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  var recyclerRef = params.harekeeperTrigger.recycler;

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  var contextPath = pluginCfg.contextPath || '/harekeeper';

  var express = params.webweaverService.express;
  var router = express.Router();

  router.route('/').get(function(req, res, next) {
    res.json(lodash.map(lodash.keys(recyclerRef), function(name) {
      return { name: name };
    }));
  });

  router.route('/:recyclebin').get(function(req, res, next) {
    debugx.enabled && debugx(' - GET [%s]', req.url);
    LX.isEnabledFor('debug') && LX.log('debug', LT.add({
      message: 'Get recyclebin information',
      recyclebin: req.params.recyclebin
    }).toMessage());
    var recycler = recyclerRef[req.params.recyclebin];
    if (!recycler) {
      res.status(400).json({
        message: 'Recyclebin not found',
        recyclebin: req.params.recyclebin
      });
      return;
    }
    recycler.checkRecyclebin().then(function(info) {
      res.json(info);
    }).catch(function(err) {
      res.status(400).json(err);
    }).finally(function() {
      LX.isEnabledFor('debug') && LX.log('debug', LT.add({
        message: 'Get recyclebin information - finally'
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
