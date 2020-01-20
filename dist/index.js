'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProxiesActiveExpression = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.reset = reset;
exports.unwrap = unwrap;
exports.wrap = wrap;
exports.aexpr = aexpr;

var _activeExpressions = require('active-expressions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

global.__expressionAnalysisMode__ = false;

global.__currentActiveExpression__ = false;

function reset() {
  // maps from target ids to active expressions
  global.__proxyIdToActiveExpressionsMap__ = new Map();

  // maps from proxy to target
  global.__proxyToTargetMap__ = new WeakMap();
}

reset();

var basicHandlerFactory = function basicHandlerFactory(id) {
  return {
    get: function get(target, property) {
      if (global.__expressionAnalysisMode__) {
        var dependencies = global.__proxyIdToActiveExpressionsMap__.get(id);

        dependencies.add(global.__currentActiveExpression__);
        global.__proxyIdToActiveExpressionsMap__.set(id, dependencies);
      }
      if (typeof target[property] === 'function') {
        return Reflect.get(target, property).bind(target);
      }
      return Reflect.get(target, property);
    },

    set: function set(target, property, value) {
      Reflect.set(target, property, value);

      global.__proxyIdToActiveExpressionsMap__.get(id).forEach(function (dependentActiveExpression) {
        return dependentActiveExpression.notifyOfUpdate();
      });
      return true;
    }
  };
};

var functionHandlerFactory = function functionHandlerFactory(id) {
  return {
    apply: function apply(target, thisArg, argumentsList) {
      thisArg = global.__proxyToTargetMap__.get(thisArg) || thisArg;

      if (global.__expressionAnalysisMode__) {
        return target.bind(thisArg).apply(undefined, _toConsumableArray(argumentsList));
      }
      var result = target.bind(thisArg).apply(undefined, _toConsumableArray(argumentsList));
      global.__proxyIdToActiveExpressionsMap__.get(id).forEach(function (dependentActiveExpression) {
        return dependentActiveExpression.notifyOfUpdate();
      });
      return result;
    }
  };
};

function unwrap(proxy) {
  return global.__proxyToTargetMap__.get(proxy) || proxy;
}

function wrap(typeOfWhat, what) {
  if (global.__proxyToTargetMap__.has(what)) return what;
  var id = global.__proxyIdToActiveExpressionsMap__.size;
  var basicHandler = basicHandlerFactory(id);

  if (typeOfWhat !== 'Object') {

    var prototypes = {
      "Set": Set.prototype,
      "Map": Map.prototype,
      "Array": Array.prototype
    };

    var functionHandler = functionHandlerFactory(id);
    var methods = Object.getOwnPropertyNames(prototypes[typeOfWhat]).filter(function (propName) {
      return typeof what[propName] === 'function';
    });
    methods.forEach(function (method) {
      return what[method] = new Proxy(what[method], functionHandler);
    });
  }

  global.__proxyIdToActiveExpressionsMap__.set(id, new Set());
  var proxy = new Proxy(what, basicHandler);
  global.__proxyToTargetMap__.set(proxy, what);

  return proxy;
}

function aexpr(func) {
  for (var _len = arguments.length, arg = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    arg[_key - 1] = arguments[_key];
  }

  return new (Function.prototype.bind.apply(ProxiesActiveExpression, [null].concat([func], arg)))();
}

var ProxiesActiveExpression = exports.ProxiesActiveExpression = function (_BaseActiveExpression) {
  _inherits(ProxiesActiveExpression, _BaseActiveExpression);

  function ProxiesActiveExpression(func) {
    var _ref;

    _classCallCheck(this, ProxiesActiveExpression);

    for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    var _this = _possibleConstructorReturn(this, (_ref = ProxiesActiveExpression.__proto__ || Object.getPrototypeOf(ProxiesActiveExpression)).call.apply(_ref, [this, func].concat(args)));

    _this.notifyOfUpdate();
    return _this;
  }

  _createClass(ProxiesActiveExpression, [{
    key: 'notifyOfUpdate',
    value: function notifyOfUpdate() {
      global.__expressionAnalysisMode__ = true;
      global.__currentActiveExpression__ = this;

      this.func();
      this.checkAndNotify();

      global.__expressionAnalysisMode__ = false;
    }
  }]);

  return ProxiesActiveExpression;
}(_activeExpressions.BaseActiveExpression);