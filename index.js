import { BaseActiveExpression } from 'active-expressions';

const globalOrWindow = typeof window == "undefined" ? global : window;

globalOrWindow.__expressionAnalysisMode__ = false;

globalOrWindow.__currentActiveExpression__ = false;

// maps from proxy to target
globalOrWindow.__proxyToTargetMap__ = new WeakMap();

// maps from target ids to active expressions
globalOrWindow.__proxyIdToActiveExpressionsMap__ = new Map();

export function reset() {
    globalOrWindow.__proxyIdToActiveExpressionsMap__.clear();
    globalOrWindow.__proxyToTargetMap__ = new WeakMap();
}

const basicHandlerFactory = id => ({
    get: (target, property) => {
        if (globalOrWindow.__expressionAnalysisMode__) {
            let dependencies = globalOrWindow.__proxyIdToActiveExpressionsMap__.get(id);

            dependencies.add(globalOrWindow.__currentActiveExpression__);
            globalOrWindow.__proxyIdToActiveExpressionsMap__.set(id, dependencies);
        }
        if (typeof target[property] === 'function') {
            return Reflect.get(target, property).bind(target);
        }
        return Reflect.get(target, property);
    },

    set: (target, property, value) => {
        Reflect.set(target, property, value);

        if (!globalOrWindow.__proxyIdToActiveExpressionsMap__.has(id)){
            globalOrWindow.__proxyIdToActiveExpressionsMap__.set(id, {});
          }
          
        globalOrWindow.__proxyIdToActiveExpressionsMap__
            .get(id)
            .forEach(dependentActiveExpression =>
                dependentActiveExpression.notifyOfUpdate()
            );
        return true;
    },
});

const functionHandlerFactory = id => ({
    apply: (target, thisArg, argumentsList) => {
        thisArg = globalOrWindow.__proxyToTargetMap__.get(thisArg) || thisArg;

        if (globalOrWindow.__expressionAnalysisMode__) {
            return target.bind(thisArg)(...argumentsList);
        }
        const result = target.bind(thisArg)(...argumentsList);
        globalOrWindow.__proxyIdToActiveExpressionsMap__
            .get(id)
            .forEach(dependentActiveExpression =>
                dependentActiveExpression.notifyOfUpdate()
            );
        return result;
    },
});

export function unwrap(proxy) {
    return globalOrWindow.__proxyToTargetMap__.get(proxy) || proxy;
}

export function wrap(typeOfWhat, what) {
    if (globalOrWindow.__proxyToTargetMap__.has(what)) return what;
    const id = globalOrWindow.__proxyIdToActiveExpressionsMap__.size;
    const basicHandler = basicHandlerFactory(id);
  
      const prototypes = {
          "Set": Set.prototype,
          "Map": Map.prototype,
          "Array": Array.prototype
      };
  
    if (prototypes[typeOfWhat]) {
      const functionHandler = functionHandlerFactory(id);
      const methods = Object.getOwnPropertyNames(prototypes[typeOfWhat]).filter(
        propName => typeof what[propName] === 'function'
      );
      methods.forEach(
        method => (what[method] = new Proxy(what[method], functionHandler))
      );
    }
  
    globalOrWindow.__proxyIdToActiveExpressionsMap__.set(id, new Set());
    const proxy = new Proxy(what, basicHandler);
    globalOrWindow.__proxyToTargetMap__.set(proxy, what);
  
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
        globalOrWindow.__expressionAnalysisMode__ = true;
        globalOrWindow.__currentActiveExpression__ = this;

        this.func();
        this.checkAndNotify();

        globalOrWindow.__expressionAnalysisMode__ = false;
    }
}
