import { BaseActiveExpression } from 'active-expressions';

global.__expressionAnalysisMode__ = false;

global.__currentActiveExpression__ = false;

// maps from proxy to target
global.__proxyToTargetMap__ = new WeakMap();

// maps from target ids to active expressions
global.__proxyIdToActiveExpressionsMap__ = new Map();

export function reset() {
  global.__proxyIdToActiveExpressionsMap__.clear();
  global.__proxyIdToActiveExpressionsMap__ = new Map();
}

const basicHandlerFactory = id => ({
  get: (target, property) => {
    if (global.__expressionAnalysisMode__) {
      let dependencies = global.__proxyIdToActiveExpressionsMap__.get(id);
      dependencies.add(global.__currentActiveExpression__);
      global.__proxyIdToActiveExpressionsMap__.set(id, dependencies);
    }
    if (typeof target[property] === 'function') {
      return Reflect.get(target, property).bind(target);
    }
    return Reflect.get(target, property);
  },

  set: (target, property, value) => {
    Reflect.set(target, property, value);

    if (!global.__proxyIdToActiveExpressionsMap__.has(id)){
      global.__proxyIdToActiveExpressionsMap__.set(id, new Set());
    }
    
    global.__proxyIdToActiveExpressionsMap__
      .get(id)
      .forEach(dependentActiveExpression =>
        dependentActiveExpression.notifyOfUpdate()
      );
    return true;
  },
  
  deleteProperty(target, property) {
    if (property in target) {
      delete target[property];
      if (!global.__proxyIdToActiveExpressionsMap__.has(id)){
        global.__proxyIdToActiveExpressionsMap__.set(id, {});
      }

      global.__proxyIdToActiveExpressionsMap__
        .get(id)
        .forEach(dependentActiveExpression =>
          dependentActiveExpression.notifyOfUpdate()
      );
      
      return true
    }
    return false
  }
});

const functionHandlerFactory = id => ({
  apply: (target, thisArg, argumentsList) => {
    thisArg = global.__proxyToTargetMap__.get(thisArg) || thisArg;

    if (global.__expressionAnalysisMode__) {
      return target.bind(thisArg)(...argumentsList);
    }
    const result = target.bind(thisArg)(...argumentsList);
    global.__proxyIdToActiveExpressionsMap__
      .get(id)
      .forEach(dependentActiveExpression =>
        dependentActiveExpression.notifyOfUpdate()
      );
    return result;
  },
});

export function unwrap(proxy) {
  return global.__proxyToTargetMap__.get(proxy) || proxy;
}

export function wrap(typeOfWhat, what) {
  if (global.__proxyToTargetMap__.has(what)) return what;
  const id = global.__proxyIdToActiveExpressionsMap__.size;
  const basicHandler = basicHandlerFactory(id);

  if (typeOfWhat !== 'Object'){
    const functionHandler = functionHandlerFactory(id);
    const methods = Object.getOwnPropertyNames(eval(typeOfWhat).prototype).filter(
      propName => typeof what[propName] === 'function'
    );
    methods.forEach(
      method => (what[method] = new Proxy(what[method], functionHandler))
    );
  }

  global.__proxyIdToActiveExpressionsMap__.set(id, new Set());
  const proxy = new Proxy(what, basicHandler);
  global.__proxyToTargetMap__.set(proxy, what);

  return proxy;
}


export function aexpr(func, ...arg) {
  return new ProxiesActiveExpression(func, ...arg);
}

export class ProxiesActiveExpression extends BaseActiveExpression {
  constructor(func, ...args) {
    super(func, ...args);
    this.notifyOfUpdate();
  }

  notifyOfUpdate() {
    global.__expressionAnalysisMode__ = true;
    global.__currentActiveExpression__ = this;

    this.func();
    this.checkAndNotify();

    global.__expressionAnalysisMode__ = false;
  }
}
