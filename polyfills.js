// 🔧 Browser Compatibility Polyfills for Older Devices
// This file adds support for modern JavaScript features on older browsers

(function() {
  'use strict';
  
  console.log('🔧 Loading compatibility polyfills...');
  
  // 1. Optional Chaining Polyfill (?.operator)
  // This is the most critical one - used everywhere in the code
  if (!String.prototype.includes('?.')) {
    // Simple polyfill for basic optional chaining
    window.optionalChain = function(obj, path) {
      try {
        return path.split('.').reduce((current, prop) => {
          return current && current[prop] !== undefined ? current[prop] : undefined;
        }, obj);
      } catch (e) {
        return undefined;
      }
    };
  }
  
  // 2. Object.assign polyfill
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
      
      var to = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
        if (nextSource != null) {
          for (var nextKey in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }
  
  // 3. Promise polyfill (for very old browsers)
  if (typeof Promise === 'undefined') {
    console.warn('⚠️ Promise not supported - loading polyfill');
    window.Promise = function(executor) {
      var self = this;
      self.state = 'pending';
      self.value = undefined;
      self.handlers = [];
      
      function resolve(result) {
        if (self.state === 'pending') {
          self.state = 'fulfilled';
          self.value = result;
          self.handlers.forEach(handle);
          self.handlers = null;
        }
      }
      
      function reject(error) {
        if (self.state === 'pending') {
          self.state = 'rejected';
          self.value = error;
          self.handlers.forEach(handle);
          self.handlers = null;
        }
      }
      
      function handle(handler) {
        if (self.state === 'pending') {
          self.handlers.push(handler);
        } else {
          if (self.state === 'fulfilled' && typeof handler.onFulfilled === 'function') {
            handler.onFulfilled(self.value);
          }
          if (self.state === 'rejected' && typeof handler.onRejected === 'function') {
            handler.onRejected(self.value);
          }
        }
      }
      
      this.then = function(onFulfilled, onRejected) {
        return new Promise(function(resolve, reject) {
          handle({
            onFulfilled: function(result) {
              try {
                resolve(onFulfilled ? onFulfilled(result) : result);
              } catch (ex) {
                reject(ex);
              }
            },
            onRejected: function(error) {
              try {
                resolve(onRejected ? onRejected(error) : error);
              } catch (ex) {
                reject(ex);
              }
            }
          });
        });
      };
      
      executor(resolve, reject);
    };
  }
  
  // 4. fetch polyfill for older browsers
  if (!window.fetch) {
    console.warn('⚠️ Fetch not supported - using XMLHttpRequest fallback');
    window.fetch = function(url, options) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        options = options || {};
        
        xhr.open(options.method || 'GET', url);
        
        if (options.headers) {
          for (var key in options.headers) {
            xhr.setRequestHeader(key, options.headers[key]);
          }
        }
        
        xhr.onload = function() {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            statusText: xhr.statusText,
            json: function() {
              return Promise.resolve(JSON.parse(xhr.responseText));
            },
            text: function() {
              return Promise.resolve(xhr.responseText);
            }
          });
        };
        
        xhr.onerror = function() {
          reject(new Error('Network error'));
        };
        
        xhr.send(options.body);
      });
    };
  }
  
  // 5. Web Audio API fallback
  if (!window.AudioContext && !window.webkitAudioContext) {
    console.warn('⚠️ Web Audio API not supported - disabling sound effects');
    window.AudioContext = function() {
      return {
        createOscillator: function() { return { connect: function() {}, start: function() {}, stop: function() {} }; },
        createGain: function() { return { connect: function() {}, gain: { value: 0 } }; },
        destination: {}
      };
    };
  }
  
  // 6. Navigator API fallbacks
  if (!navigator.vibrate) {
    navigator.vibrate = function() {
      console.log('Vibration not supported');
      return false;
    };
  }
  
  if (!navigator.clipboard) {
    navigator.clipboard = {
      writeText: function(text) {
        // Fallback clipboard implementation
        var textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        return new Promise(function(resolve, reject) {
          try {
            var success = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (success) {
              resolve();
            } else {
              reject(new Error('Copy command failed'));
            }
          } catch (err) {
            document.body.removeChild(textArea);
            reject(err);
          }
        });
      }
    };
  }
  
  // 7. Console polyfill for very old devices
  if (!window.console) {
    window.console = {
      log: function() {},
      warn: function() {},
      error: function() {},
      info: function() {}
    };
  }
  
  // 8. Array.find polyfill
  if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
      if (this == null) {
        throw new TypeError('Array.prototype.find called on null or undefined');
      }
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }
      var list = Object(this);
      var length = parseInt(list.length) || 0;
      var thisArg = arguments[1];
      var value;

      for (var i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(thisArg, value, i, list)) {
          return value;
        }
      }
      return undefined;
    };
  }
  
  // 9. String.includes polyfill
  if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
      if (typeof start !== 'number') {
        start = 0;
      }
      
      if (start + search.length > this.length) {
        return false;
      } else {
        return this.indexOf(search, start) !== -1;
      }
    };
  }
  
  // 10. CSS Custom Properties fallback detection
  var supportsCustomProperties = (function() {
    try {
      return CSS.supports('--fake-var', '0');
    } catch (e) {
      return false;
    }
  })();
  
  if (!supportsCustomProperties) {
    console.warn('⚠️ CSS Custom Properties not supported - using fallback colors');
    document.documentElement.className += ' no-css-vars';
  }
  
  console.log('✅ Compatibility polyfills loaded successfully');
  
})();
