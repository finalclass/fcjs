/**
 Copyright (C) 2012 Szymon Wygnański (s@finalclass.net)

 Permission is hereby granted, free of charge, to any person obtaining a copy of
 this software and associated documentation files (the "Software"), to deal in
 the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do
 so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */
var fc = (function () {
  var stage = null;
  var beans = new Object();

  var fc = function (context, propertyName) {
    var that = this;
    if (context.__meta == undefined) {
      context.__meta = {
        postConstructListeners:new Array(),
        dependencies:new Array(),
        eventHandlers:new Object(),
        bindables:new Array()
      };
    }

    this.context = function (value) {
      if (value == undefined) {
        return context;
      }
      context = value;
      return this;
    };

    this.bindable = function () {
      context.__meta.bindables.push({propertyName:propertyName});
    };

    this.inject = function (what) {
      context.__meta.dependencies.push({propertyName:propertyName, dependencyName:what});
      return this;
    };

    this.postConstruct = function () {
      context.__meta.postConstructListeners.push(propertyName);
      return this;
    };

    this.eventHandler = function (eventDefinition) {
      if (typeof eventDefinition == 'string') {
        eventDefinition = {event:eventDefinition};
      }
      if (eventDefinition.properties == undefined) {
        eventDefinition.properties = new Array();
      }

      if (context.__meta.eventHandlers[eventDefinition.event] == undefined) {
        context.__meta.eventHandlers[eventDefinition.event] = new Array();
      }
      eventDefinition.propertyName = propertyName;
      context.__meta.eventHandlers[eventDefinition.event].push(eventDefinition);
      return this;
    };

    return this;
  };

  /////////////////////////////////////////Stage
  fc.stage = function (value) {
    if (!value) {
      return stage;
    }
    stage = value;
    stage.__oldDispatchEvent = stage.dispatchEvent;
    stage.dispatchEvent = function (event) {
      stage.__oldDispatchEvent(event);
      fc.dispatchEvent(event);
    };
  };

  /////////////////////////////////////////Beans

  function initBean(bean, name) {
    var i;
    if (!bean.__meta) {
      return;
    }

    //Meta name

    do {
      name = name || Date.now() * Math.random();
    } while (!name && beans[name]);

    //Inject and Dependencies

    for (i in bean.__meta.dependencies) {
      if (!bean.__meta.dependencies.hasOwnProperty(i)) {
        continue;
      }
      var dep = bean.__meta.dependencies[i];
      bean[dep.propertyName] = beans[dep.dependencyName];
    }

    for (i in bean.__meta.bindables) {
      if (!bean.__meta.bindables.hasOwnProperty(i)) {
        continue;
      }
      var definition = bean.__meta.bindables[i];

      if (Object.prototype.toString.call(bean[definition.propertyName]) === '[object Array]') {
        bean[definition.propertyName] = ko.observableArray(bean[definition.propertyName]);
      } else if(typeof bean[definition.propertyName] == 'function') {
        bean[definition.propertyName] = ko.dependentObservable(bean[definition.propertyName]);
      } else {
        bean[definition.propertyName] = ko.observable(bean[definition.propertyName]);
      }

    }

    //Post Construct

    for (i in bean.__meta.postConstructListeners) {
      if (!bean.__meta.postConstructListeners.hasOwnProperty(i)) {
        continue;
      }
      var propName = bean.__meta.postConstructListeners[i];
      bean[propName].call(bean);
    }
    fc.eventer(bean).dispatchEvent({type:'postConstruct', bean:"bean"});

    //Event Handlers

    for (var eventName in bean.__meta.eventHandlers) {
      if (!bean.__meta.eventHandlers.hasOwnProperty(eventName)) {
        continue;
      }
      var handlers = bean.__meta.eventHandlers[eventName];
      for (var handlerName in handlers) {
        if (!handlers.hasOwnProperty(handlerName)) {
          continue;
        }
        var eventDefinition = handlers[handlerName];

        fc.on(eventName, (function (eventDefinition) {
          return function (event) {
            var properties = new Array();
            for (var i in eventDefinition.properties) {
              if (!eventDefinition.properties.hasOwnProperty(i)) {
                continue;
              }
              var propertyName = eventDefinition.properties[i];
              properties.push(event[propertyName]);
            }
            bean[eventDefinition.propertyName].apply(bean, properties)
          }

        })(eventDefinition));
      }
    }

    fc.dispatchEvent({type:'tearUp', bean:bean});
  }

  fc.beans = function (value) {
    if(!value) {
      return beans;
    }
    beans = value;
    for (var i in beans) {
      if (!beans.hasOwnProperty(i)) {
        continue;
      }
      initBean(beans[i], i);
    }
  };

  var prototypes = new Object();

  fc.prototypes = function (value) {
    if(!value) {
      return prototypes;
    }
    prototypes = value;
  };

  fc.initBean = function (bean) {
    initBean(bean);
  };

  fc.beanExists = function (name) {
    return beans[name] != undefined;
  };

  ////////////////////////Listeners

  var listeners = new Object();

  function getListeners(eventType) {
    if (listeners[eventType] == undefined) {
      listeners[eventType] = new Array();
    }
    return listeners[eventType];
  }

  fc.on = function (eventType, callback) {
    var callbacks = getListeners(eventType);
    callbacks.push(callback);
  };

  fc.dispatchEvent = function (event) {
    var callbacks = getListeners(event.type);
    for (var i in callbacks) {
      if (callbacks.hasOwnProperty(i)) {
        callbacks[i](event);
      }
    }
  };

  fc.on('addedToStage', function (event) {
    initBean(event.target);
  });

  ///////FC . Events


  fc.eventer = function (dispatcher) {
    if (this.constructor != fc.eventer) {
      return new fc.eventer(dispatcher);
    }

    function getListeners(eventName) {

      if (dispatcher.__listeners == undefined) {
        dispatcher.__listeners = new Array();
      }

      if (dispatcher.__listeners[eventName] == undefined) {
        dispatcher.__listeners[eventName] = new Array();
      }

      return dispatcher.__listeners[eventName];
    }

    this.on = function (eventName, callback) {
      var listeners = getListeners(eventName);
      listeners.push(callback);
    };

    this.dispatchEvent = function (event) {
      var listeners = getListeners(event.type);
      for (var i in listeners) {
        if (!listeners.hasOwnProperty(i)) {
          continue;
        }
        listeners[i](event);
      }
      return this;
    };

    this.removeEventListener = function (eventName, listener) {
      var listeners = getListeners(eventName);
      listeners.splice(listeners.indexOf(listener), 1);
      return this;
    };

    return this;
  };


  return fc;
})();