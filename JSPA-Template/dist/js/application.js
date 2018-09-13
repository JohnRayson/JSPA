var Config = (function () {
    function Config() {
        this.utils = new Utils();
        this.sessionStore = new LocalStore("session");
        this.api = new Api("");
        this.verboseMessages = false;
        this.contentElementId = "application";
        this.routes = [
            new Route("error/?code:number", ClientError),
            new Route("app-header", AppHeader),
            new Route("app-footer", AppFooter),
            new Route("qunit", JSPATests),
            new Route("qunit/?testId:query", JSPATests),
            new Route("", Home),
            new Route("component-1", Component1),
        ];
        this.database = {
            name: "jquery-spa",
            version: 1,
            stores: {
                "jspa": {
                    key: { keyPath: "Id" },
                    indexes: []
                },
            }
        };
        this.dateTimePickerDefault = {
            calendarWeeks: true,
            format: "DD/MM/YYYY HH:mm:ss",
            showTodayButton: true,
            showClear: true,
            showClose: true,
        };
    }
    Config.prototype.load = function (app) {
        app.routing.drawStaticRoute($("#app-navigation"), "app-header");
        app.routing.drawStaticRoute($("#app-footer"), "app-footer");
    };
    return Config;
}());
var Api = (function () {
    function Api(baseHref) {
        this.localDb = new LocalDB();
        this.baseHref = "";
        this.token = null;
        this.apiVersion = 0;
        this.headers = {
            "Content-Type": "application/json",
            "X-Authentication": "",
            "Accept": "application/json, text/plain, */*;" + (this.apiVersion > 0 ? "version=" + this.apiVersion + ";" : "")
        };
        this.subsriptions = [];
        if (baseHref)
            this.baseHref = baseHref;
        this.isAuthenticated();
    }
    Api.prototype.auth = function (model) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            resolve(_this.post("auth/authenticate", model));
        }).then(function (reply) {
            _this.storeSessionData(reply.token);
            return reply.user;
        });
    };
    Api.prototype.storeSessionData = function (token) {
        console.log("API.storeSessionData(): ", token);
        this.token = token;
        window.sessionStorage.setItem("token", token);
        this.headers["X-Authentication"] = token;
        return true;
    };
    Api.prototype.isAuthenticated = function () {
        if (window.sessionStorage.getItem("token")) {
            this.token = window.sessionStorage.getItem("token");
            this.headers["X-Authentication"] = this.token;
            return true;
        }
        return false;
    };
    Api.prototype.logout = function () {
        var _this = this;
        var api = this;
        return new Promise(function (resolve) {
            resolve(_this.get("auth/logout"));
        }).then(function (reply) {
            api.token = null;
            window.sessionStorage.removeItem("token");
            api.headers["X-Authentication"] = "";
        });
    };
    Api.prototype.send = function (request) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            $.ajax(request).always(function (data, textStatus, jqXHR) {
                if (!jqXHR.status) {
                    var tmp = data;
                    data = jqXHR;
                    jqXHR = tmp;
                }
                if (jqXHR.status == 200) {
                    return resolve(data);
                }
                if (jqXHR.status == 418) {
                    var nonce = JSON.parse(jqXHR.responseText).nonce;
                    if (nonce && request.nonceRetryAttempts < 2) {
                        console.log("Heres my nonce: ", nonce);
                        request.headers["X-Nonce"] = nonce;
                        request.nonceRetryAttempts++;
                        return resolve(_this.send(request));
                    }
                }
                if (jqXHR.status == 0) {
                    app.online = false;
                }
                if (jqXHR.status == 401) {
                    config.routes[0].component.draw({ code: jqXHR.status, text: textStatus }).then(function ($content) {
                        $("#" + config.contentElementId).replaceWith($("<div id= '" + config.contentElementId + "' />").append($content));
                    });
                }
                if (jqXHR.status == 400 || jqXHR.status == 403) {
                    console.log("Api.send(): ", jqXHR.status);
                }
                return reject(jqXHR);
            });
        });
    };
    Api.prototype.createRequest = function (url, method, data) {
        if (method === void 0) { method = null; }
        if (data === void 0) { data = null; }
        var request = new ApiRequest();
        request.method = method || "GET";
        request.url = url;
        request.headers = $.extend({}, {}, this.headers);
        request.data = (data != null ? JSON.stringify(data) : null);
        return request;
    };
    Api.prototype.subscribe = function (path, options, success, fail) {
        var sub = null;
        for (var i = 0; i < this.subsriptions.length; i++) {
            if (path === this.subsriptions[i].url) {
                sub = this.subsriptions[i];
                break;
            }
        }
        if (!sub) {
            sub = new Subscription(path, this, options);
            this.subsriptions.push(sub);
        }
        var ref = new Utils().createUUID();
        sub.callbacks.push({ id: ref, func: success });
        this.localDb.retrieve(options.datastore, function (item) {
            var matched = true;
            for (var member in options.retrieve) {
                if (item.value[member] !== options.retrieve[member])
                    matched = false;
            }
            if (matched) {
                success(item.value);
            }
        });
        sub.api.get(sub.url, sub.options)
            .then(function (reply) {
            success(reply);
        })
            .catch(function (rej) {
            fail(rej);
        });
        if (sub.state() == "stopped") {
            sub.start();
        }
        return ref;
    };
    Api.prototype.unsubscribe = function (id) {
        if (config.verboseMessages)
            console.log("VERBOSE:: API.unsubscribe(): ", { lookingfor: id, in: this.subsriptions });
        for (var i = 0; i < this.subsriptions.length; i++) {
            for (var j = 0; j < this.subsriptions[i].callbacks.length; j++) {
                if (id === this.subsriptions[i].callbacks[j].id) {
                    var removed = this.subsriptions[i].callbacks.splice(j, 1);
                    if (this.subsriptions[i].callbacks.length == 0) {
                        this.subsriptions[i].stop();
                        this.subsriptions.splice(i, 1);
                    }
                    break;
                }
            }
        }
    };
    Api.prototype.pauseSubscriptions = function () {
        for (var i = 0; i < this.subsriptions.length; i++) {
            if (this.subsriptions[i].state() == "running")
                this.subsriptions[i].pause();
        }
    };
    Api.prototype.resumeSubscriptions = function () {
        for (var i = 0; i < this.subsriptions.length; i++) {
            if (this.subsriptions[i].state() == "paused")
                this.subsriptions[i].start();
        }
    };
    Api.prototype.get = function (path, options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var request = _this.createRequest(_this.baseHref + path);
            var getReply = null;
            if (options && options.datastore) {
                _this.localDb.retrieve(options.datastore, function (item) {
                    var matched = true;
                    for (var member in options.retrieve) {
                        if (item.value[member] !== options.retrieve[member])
                            matched = false;
                    }
                    if (matched)
                        return item.value;
                }).then(function (reply) {
                    getReply = reply;
                    _this.send(request)
                        .then(function (reply) {
                        if (options && options.datastore) {
                            _this.localDb.store(options.datastore, reply).then(function (changes) {
                                if (!options.onlyChanges)
                                    resolve(reply);
                                else if (changes.changed)
                                    resolve(changes.data);
                                else
                                    resolve(null);
                            });
                        }
                        else
                            resolve(reply);
                    }).catch(function (ex) {
                        if (!options.onlyChanges)
                            resolve(getReply);
                        else
                            reject(ex);
                    });
                });
            }
            else {
                _this.send(request)
                    .then(function (reply) {
                    return resolve(reply);
                })
                    .catch(function (ex) { return reject(ex); });
            }
        });
    };
    Api.prototype.post = function (path, data) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var request = _this.createRequest(_this.baseHref + path, "POST", data);
            _this.send(request)
                .then(function (reply) {
                return resolve(reply);
            })
                .catch(function (ex) {
                return reject(ex);
            });
        });
    };
    Api.prototype.delete = function (path) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var request = _this.createRequest(_this.baseHref + path, "DELETE");
            _this.send(request)
                .then(function (reply) {
                return resolve(reply);
            })
                .catch(function (ex) {
                return reject(ex);
            });
        });
    };
    Api.prototype.form = function (path, $form) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var data = new FormData($form[0]);
            var request = _this.createRequest(_this.baseHref + path, "POST");
            request.data = data;
            request["cache"] = false;
            request["dataType"] = "json";
            request["processData"] = false;
            request["contentType"] = false;
            delete request.headers["Content-Type"];
            _this.send(request)
                .then(function (reply) {
                console.log("Api.form(): REPLY: ", reply);
                return resolve(reply);
            })
                .catch(function (ex) {
                reject(ex);
            });
        });
    };
    return Api;
}());
var AuthModel = (function () {
    function AuthModel() {
    }
    return AuthModel;
}());
var ApiRequest = (function () {
    function ApiRequest() {
        this.nonceRetryAttempts = 0;
    }
    return ApiRequest;
}());
var ApiRequestOptions = (function () {
    function ApiRequestOptions() {
        this.onlyChanges = false;
    }
    return ApiRequestOptions;
}());
var Subscription = (function () {
    function Subscription(path, api, options) {
        this.status = "stopped";
        this.frequency = 5;
        this.statusNot200 = false;
        this.callbacks = [];
        this.url = path;
        this.api = api;
        this.options = options;
    }
    Subscription.prototype.state = function () {
        return this.status;
    };
    Subscription.prototype.start = function (freq) {
        var _this = this;
        if (freq)
            this.frequency = freq;
        this.status = "running";
        var subOptions = $.extend({}, this.options, { onlyChanges: true });
        console.log("Subscription.start()");
        this.interval = window.setInterval(function () {
            _this.api.get(_this.url, subOptions).then(function (reply) {
                if (reply != null) {
                    for (var s = 0; s < _this.callbacks.length; s++) {
                        _this.callbacks[s].func(reply);
                    }
                }
            }).catch(function (ex) {
                _this.statusNot200 = true;
                _this.stop();
            });
        }, (this.frequency * 1000));
    };
    Subscription.prototype.stop = function () {
        console.log("Subscription.stop()");
        this.status = "stopped";
        window.clearInterval(this.interval);
    };
    Subscription.prototype.pause = function () {
        console.log("Subscription.pause()");
        this.status = "paused";
        window.clearInterval(this.interval);
    };
    return Subscription;
}());
var Utils = (function () {
    function Utils() {
        this.minutesPastMidnight = {
            toTime: function (mins) {
                var minutes = (mins % 60);
                var hours = ((mins - minutes) / 60);
                return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes;
            },
            toNumber: function (time) {
                var parts = time.split(":");
                return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
            }
        };
    }
    Utils.prototype.createUUID = function () {
        var d = new Date().getTime();
        if (window.performance && typeof window.performance.now === "function") {
            d += performance.now();
        }
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    };
    Utils.prototype.toNumber = function (value) {
        if (value === '')
            return null;
        if (typeof (value) === "boolean")
            return null;
        var num = Number(value);
        if (isNaN(num))
            return null;
        if (!isFinite(num))
            return null;
        return num;
    };
    Utils.prototype.round = function (num, places) {
        if (places == 0)
            return Math.round(num);
        var calc = Math.pow(10, places);
        return Math.round(num * calc) / calc;
    };
    Utils.prototype.randomNum = function (int, min, max) {
        if ($.type(min) != "number")
            min = 0;
        if ($.type(max) != "number")
            max = 100;
        var multi = (max - min + 1);
        var num = (Math.random() * multi) + min;
        if (int)
            return Math.floor(num);
        return num;
    };
    Utils.prototype.isObject = function (thing) {
        return thing === Object(thing);
    };
    Utils.prototype.fullScreenPanelToggle = function (src, url, iconWhenMin) {
        src.evt.preventDefault();
        if (!iconWhenMin)
            iconWhenMin = 'fa-window-maximize';
        if (src.$el.children('i').hasClass(iconWhenMin)) {
            src.$el.children('i').removeClass(iconWhenMin);
            src.$el.children('i').addClass('fa-window-minimize');
        }
        else if (src.$el.children('i').hasClass('fa-window-minimize')) {
            src.$el.children('i').removeClass('fa-window-minimize');
            src.$el.children('i').addClass(iconWhenMin);
        }
        src.$el.closest('.card').toggleClass('fullscreen-card');
        var did = (src.$el.closest('.card').hasClass("fullscreen-card") ? "max" : "min");
        if (did == "max") {
            var newURL = document.location.href + "^" + (url || "maximised");
            console.log(newURL);
            history.pushState({}, "maximised card", newURL);
            $("body").css({ overflowY: "hidden" });
            src.$el.data("old-title", src.$el.attr("title"));
            src.$el.attr("title", "Minimize");
        }
        else {
            app.routing.updateUrlWithoutNavigating(document.location.href.split("^")[0]);
            $("body").css({ overflowY: "auto" });
            src.$el.attr("title", src.$el.data("old-title"));
        }
        return did;
    };
    Utils.prototype.textFit = function ($container) {
        var $parent = $container.parent();
        while ($container.height() > $parent.height()) {
            var fontsize = parseInt($parent.css('font-size')) - 1;
            $parent.css('font-size', fontsize);
            if (fontsize <= 1 || parseInt($parent.css('font-size')) >= fontsize + 1)
                break;
        }
    };
    Utils.prototype.fromQueryParams = function (input, template) {
        var reply = {};
        var params = input.replace("?", "").split("&");
        for (var p = 0; p < params.length; p++) {
            var d = params[p].split("=");
            var property = d[0];
            d.splice(0, 1);
            reply[property] = d.join("=");
        }
        if (!this.isObject(template))
            template = {};
        for (var t in template) {
            if (reply[t]) {
                var type = template[t];
                if (type.indexOf("base64") == 0) {
                    type = type.split("-")[1];
                    reply[t] = atob(reply[t]);
                }
                switch (type) {
                    default: break;
                    case "number":
                        reply[t] = parseFloat(reply[t]);
                        break;
                    case "int":
                        reply[t] = parseInt(reply[t]);
                        break;
                    case "json":
                        reply[t] = JSON.parse(reply[t]);
                        break;
                }
            }
        }
        return reply;
    };
    Utils.prototype.randomColour = function (constraint) {
        var min = 0;
        var max = 255;
        switch (constraint) {
            default:
                break;
            case "dark":
                max = 200;
                break;
            case "light":
                min = 50;
                break;
        }
        var str = "rgb(" + this.randomNum(true, min, max) + "," + this.randomNum(true, min, max) + "," + this.randomNum(true, min, max) + ")";
        return this.colourConvert(str);
    };
    Utils.prototype.colourConvert = function (input) {
        function componentToHex(c) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }
        function rgbToHex(r, g, b) {
            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
        }
        function hexToRgb(hex) {
            var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            hex = hex.replace(shorthandRegex, function (m, r, g, b) {
                return r + r + g + g + b + b;
            });
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
                rgb: "rgb(" + parseInt(result[1], 16) + "," + parseInt(result[2], 16) + "," + parseInt(result[3], 16) + ")"
            } : null;
        }
        var reply = new JSPAColour();
        if (input.substring(0, 1) == "#") {
            reply.hex = input;
            var rgb = hexToRgb(input);
            for (var m in rgb) {
                reply[m] = rgb[m];
            }
        }
        if (input.substring(0, 3) == "rgb") {
            var data = input.split("(")[1].replace(")", "").split(",");
            reply.hex = rgbToHex(parseInt(data[0]), parseInt(data[1]), parseInt(data[2]));
            var rgb = hexToRgb(reply.hex);
            for (var m in rgb) {
                reply[m] = rgb[m];
            }
        }
        return reply;
    };
    Utils.prototype.ordinal = function (num) {
        var numStr = num.toString();
        var lastNum = parseInt(numStr.slice(-1));
        switch (lastNum) {
            case 1: return numStr + "st";
            case 2: return numStr + "nd";
            case 3: return numStr + "rd";
            default: return numStr + "th";
        }
    };
    return Utils;
}());
if (typeof JSON.clone !== "function") {
    JSON.clone = function clone(object, decycle) {
        if (decycle === void 0) { decycle = true; }
        if (decycle)
            return JSON.retrocycle(JSON.parse(JSON.stringify(JSON.decycle(object))));
        return JSON.parse(JSON.stringify(object));
    };
}
if (typeof console.freeze !== "function") {
    console.freeze = function freeze(message, object) {
        if (object) {
            console.info("FREEZE: " + message, JSON.clone(object));
        }
        else
            console.info("FREEZE: " + message);
    };
}
var config = null;
var app = null;
var App = (function () {
    function App() {
        this.online = false;
        this.routing = null;
        this.utils = new Utils();
        this.hasLoaded = false;
        this.navigateOnHashChange = true;
        this.loading = null;
        this.recievers = {};
        var that = this;
        (function () {
            if (!navigator["serviceWorker"]) {
                console.log('Service workers are not supported.');
                return;
            }
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('./serviceworker.js', { scope: './' }).then(function (registration) {
                    console.log('Service worker registration succeeded:', registration);
                }).catch(function (error) {
                    console.log('Service worker registration failed:', error);
                });
            });
        })();
        $(document).ready(function () {
            app = that;
            config = new Config();
            if (config.verboseMessages)
                console.warn("JSPA:: Verbose debug messages are enabled - you can disable this in config.ts");
            app.verifyDatabase();
            app.routing = new Routing(config.routes);
            $("body").delegate("a", "click", function () {
                var href = $(this).attr("href");
                var regex = new RegExp(":\/\/", "ig");
                if (regex.exec(href))
                    document.location.href = href;
                else
                    document.location.hash = app.routing.logState(href);
                return false;
            });
            $(window).bind("hashchange", function (evt) {
                if (app.navigateOnHashChange) {
                    var state = app.routing.changeState(0);
                    app.routing.navigate(state);
                }
                return;
            });
            app.loaded();
        });
    }
    App.prototype.loaded = function () {
        if (this.loading != null)
            window.clearTimeout(this.loading);
        var _loop_1 = function (r) {
            if (this_1.routing.routes[r].component.waitingOnAsync()) {
                var that_1 = this_1;
                this_1.loading = window.setTimeout(function () { that_1.loaded(); }, 250);
                return { value: void 0 };
            }
        };
        var this_1 = this;
        for (var r = 0; r < this.routing.routes.length; r++) {
            var state_1 = _loop_1(r);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        if (config.load)
            config.load(this);
        $(window).trigger("hashchange");
        this.hasLoaded = true;
    };
    App.prototype.verifyDatabase = function () {
        (function () {
            'use strict';
            if (!('indexedDB' in window)) {
                console.log('This browser doesn\'t support IndexedDB');
                return;
            }
            var dbPromise = idb.open(config.database.name, config.database.version, function (upgradeDb) {
                console.log("upgrading", upgradeDb);
                while (upgradeDb.objectStoreNames.length > 0) {
                    upgradeDb.deleteObjectStore(upgradeDb.objectStoreNames[0]);
                }
                for (var member in config.database.stores) {
                    var store = upgradeDb.createObjectStore(member, config.database.stores[member].key);
                    for (var i in config.database.stores[member].indexes) {
                        var index = config.database.stores[member].indexes[i];
                        store.createIndex(index.name, index.keyPath, index.options);
                    }
                }
            });
        })();
    };
    return App;
}());
var Pipes = (function () {
    function Pipes() {
    }
    Pipes.prototype.displayDateTime = function (utc) {
        if (!utc)
            return "";
        var parts = utc.split("T");
        if (parts[0] === "0001-01-01")
            return "";
        if (parts.length != 2)
            return utc;
        var dateBits = parts[0].split("-");
        if (dateBits.length != 3)
            return utc;
        return dateBits[2] + "/" + dateBits[1] + "/" + dateBits[0] + " " + parts[1].replace("Z", "").split(".")[0];
    };
    Pipes.prototype.addGMT = function (date) {
        if (date.length > 0)
            return date + " (GMT)";
        else
            return date;
    };
    Pipes.prototype.removeNull = function (value) {
        if (value == null || value.toLowerCase() == "null")
            return "";
        return value;
    };
    return Pipes;
}());
var Component = (function () {
    function Component(templates, parent) {
        this.formater = new Pipes();
        this.parent = null;
        this.subscriptions = [];
        this.htmlBooleanAttrs = [
            'checked', 'selected', 'disabled', 'readonly', 'multiple', 'ismap', 'noresize'
        ];
        this.$templates = [];
        this.waitTimeout = null;
        this.placeHolderPattern = "{{([\w]*) (.*?) }}";
        this.placeHolderExr = new RegExp("{{([\w]*) (.*?) }}", "g");
        this.arrayExr = new RegExp("\\[([0-9]{1,})(.*?)\\]", "g");
        this.id = app.utils.createUUID();
        if (templates)
            this.loadTemplate(templates);
        if (parent) {
            this.parent = app.utils.createUUID();
            app.recievers[this.parent] = parent;
        }
    }
    Component.prototype.blur = function (route) {
        this.blurOther();
        while (this.subscriptions.length > 0)
            this.unsubscribe(this.subscriptions[0]);
        this.$view.empty();
        if (route) {
            route.component = new route.srcComponent();
        }
    };
    Component.prototype.blurOther = function () {
    };
    Component.prototype.postDraw = function () {
        this.drawn();
    };
    Component.prototype.drawn = function () {
    };
    Component.prototype.subscribe = function (path, options, success, fail) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var ref = config.api.subscribe(path, options, success, fail);
            _this.subscriptions.push(ref);
            resolve(ref);
        });
    };
    Component.prototype.unsubscribe = function (ref) {
        for (var s = 0; s < this.subscriptions.length; s++) {
            if (this.subscriptions[s] == ref) {
                config.api.unsubscribe(this.subscriptions[s]);
                this.subscriptions.splice(s, 1);
            }
        }
    };
    Component.prototype.recieve = function (data) {
        console.log("Recieved data, but " + this.constructor.name + " doesn't impliment recieve():", data);
    };
    Component.prototype.emit = function (data, $holder) {
        var reply = new JSPAEmit(this.constructor.name, data, $holder);
        this.callParent("recieve", reply);
    };
    Component.prototype.callParent = function (func, args) {
        if (this.parent)
            return app.recievers[this.parent][func](args);
        return null;
    };
    Component.prototype.waitingOnAsync = function () {
        for (var t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].loaded === false)
                return true;
        }
        return false;
    };
    Component.prototype.setTitle = function (title) {
        document.title = title;
    };
    Component.prototype.hasTemplate = function (search) {
        for (var t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].name == search) {
                return true;
            }
        }
        return false;
    };
    Component.prototype.waitOnData = function () {
        var waitCount = 0;
        var id = app.utils.createUUID();
        var message = "Waiting on data";
        this.$view = $("<app-waiting style='padding: 5px; text-align: center;' />").attr("id", id)
            .append($("<div />").addClass("max-width-md")
            .append($("<h1 />").text(message))
            .append($("<div />").addClass("progress")
            .append($("<div role='progressbar' aria-valuenow='100' aria-valuemin='0' aria-valuemax='100' />")
            .addClass("progress-bar progress-bar-striped progress-bar-animated")
            .css({ width: "100%" }))));
        var updateMsg = function () {
            if (waitCount < 10) {
                waitCount++;
                this.waitTimeout = window.setTimeout(function () {
                    message = message + ".";
                    $("#" + id).find($("h1")).text(message);
                    updateMsg();
                }, 1000);
            }
            else {
                $("#" + id).find("div:first")
                    .append("<br />")
                    .append($("<button type='button' class='btn btn-info' /></button>")
                    .append("<span>Go Back</span>")
                    .click(function () {
                    window.history.back();
                }))
                    .find($("h1")).text("No data recieved");
                $("#" + id).find(".progress").toggleClass("progress collapse");
            }
        };
        updateMsg();
        return this.$view;
    };
    Component.prototype.getTemplate = function (search, data) {
        if (this.waitTimeout != null) {
            window.clearTimeout(this.waitTimeout);
            this.waitTimeout = null;
        }
        var component = this;
        this.$view = this.getTemplateJQuery(search);
        if (this.$view) {
            this.bind(this.$view, $.extend({}, component, data || {}));
            return this.$view;
        }
        return $("<app-notfound />");
    };
    Component.prototype.getSubTemplate = function (search, data) {
        var component = this;
        var $view = this.getTemplateJQuery(search);
        if ($view) {
            this.bind($view, $.extend({}, component, data || {}));
            return $view;
        }
        return $("<app-notfound />");
    };
    Component.prototype.getTemplateJQuery = function (search) {
        for (var t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].name == search) {
                return this.$templates[t].content.clone();
            }
        }
        return null;
    };
    Component.prototype.loadTemplate = function (input) {
        if ($.type(input) !== "array") {
            var temp = input;
            input = [];
            input.push(temp);
        }
        for (var t = 0; t < input.length; t++) {
            var template = void 0;
            if ($.type(input[t]) === "string")
                template = new Template(input[t]);
            else
                template = new Template(input[t].url, input[t].name);
            this.$templates.push(template);
            (function (template) {
                fetch(template.url).then(function (response) {
                    var body = response.text();
                    return body;
                }).then(function (body) {
                    template.content = $("<app-" + template.name + " />").append($(body));
                    template.loaded = true;
                });
            })(template);
        }
    };
    Component.prototype.parseStructure = function (strut, component, data) {
        var reply = { ref: data, variable: null, value: null };
        try {
            var pipes = strut.split("|");
            var parts = pipes[0].split(".");
            var stuff = JSON.clone(data);
            var arr = null;
            for (var p = 0; p < parts.length; p++) {
                component.arrayExr.lastIndex = 0;
                reply.variable = parts[p];
                if ((arr = component.arrayExr.exec(parts[p])) != null) {
                    stuff = stuff[parts[p].replace(arr[0], "")][arr[1]];
                    if (p < (parts.length - 1))
                        reply.ref = reply.ref[parts[p].replace(arr[0], "")][arr[1]];
                }
                else {
                    if (stuff == null || typeof (stuff[parts[p]]) == "undefined") {
                        console.log(parts[p] + " not found in object: ", stuff);
                        return reply;
                    }
                    stuff = stuff[parts[p]];
                    if (p < (parts.length - 1))
                        reply.ref = reply.ref[parts[p]];
                }
            }
            reply.value = stuff;
            for (var pipe = 1; pipe < pipes.length; pipe++) {
                if (typeof (component.formater[pipes[pipe]]) != "undefined")
                    reply.value = component.formater[pipes[pipe]](reply.value);
                else {
                    console.log("ERROR - Pipe not found: " + pipes[pipe] + "; Piping stopped for this chain");
                    break;
                }
            }
        }
        catch (ex) {
            console.log("execption: ", ex);
            console.log("reply: ", reply);
        }
        return reply;
    };
    Component.prototype.textMultiMatch = function (content, component, data) {
        var match = null;
        var matches = [];
        var regEx = new RegExp(component.placeHolderPattern, "g");
        while ((match = regEx.exec(content)) != null) {
            var thisMatch = {
                pattern: "{{ " + match[2] + " }}",
                value: this.parseStructure(match[2], component, data).value
            };
            matches.push(thisMatch);
        }
        for (var m = 0; m < matches.length; m++) {
            content = content.replace(matches[m].pattern, matches[m].value);
        }
        return content;
    };
    Component.prototype.functionVal = function (callSignature, component, data) {
        var func = callSignature.split("(");
        var val = null;
        if (func[1]) {
            val = this.textMultiMatch(func[1].substr(0, func[1].length - 1), component, data);
        }
        return val;
    };
    Component.prototype.bind = function ($template, data) {
        var bindref = new Utils().createUUID();
        var component = this;
        function walk($el) {
            var processChildren = processEl($el);
            if (processChildren) {
                $el = $el.children().first();
                while ($el.length) {
                    walk($el);
                    $el = $el.next();
                }
            }
        }
        function processEl($el) {
            var $this = $el;
            try {
                var noBind = $this.data("no-bind");
                if (noBind) {
                    if (config.verboseMessages)
                        console.log("VERBOSE:: Component.bind().processEl() - Not binding: ", $el);
                    return false;
                }
                var cont = $this.data("bind-if");
                if (cont) {
                    $this.data("bind-if", null);
                    var comparison = component.processBindComparison(cont, component, data);
                    if (!comparison || (comparison == null && !component.parseStructure(cont, component, data).value ? true : false)) {
                        $this.addClass("dom-remove");
                        return false;
                    }
                }
                var control = $this.data("bind-control");
                if (control) {
                    switch (control) {
                        case "tabs":
                            component.tabControl($this);
                            break;
                    }
                }
                var multiple = $this.data("bind-for");
                if (multiple) {
                    $this.data("bind-for", null);
                    (function ($this, multiple, component, data) {
                        var $template = $this.children().clone();
                        var info = component.parseStructure(multiple, component, data);
                        $this.empty();
                        if (!info.value)
                            return;
                        (function ($this, $template, info) {
                            for (var i = 0; i < info.length; i++) {
                                var $new = $template.clone();
                                info[i].JSPA = i;
                                component.bind($new, info[i]);
                                $this.append($new);
                            }
                        })($this, $template, info.value);
                    })($this, multiple, component, data);
                }
                var textNodes = $this.textNodes();
                var match = null;
                var arr = null;
                for (var n = 0; n < textNodes.length; n++) {
                    var content = textNodes[n].nodeValue;
                    textNodes[n].nodeValue = component.textMultiMatch(content, component, data);
                }
                var valueAttribute = $this.val();
                if (valueAttribute) {
                    var valueExpr = new RegExp(component.placeHolderPattern, "g");
                    var match_1 = valueExpr.exec(valueAttribute);
                    if (match_1) {
                        $this.addClass("jspa-data-bound");
                        $this.data("value-src", match_1[2]);
                        $this.val(component.parseStructure(match_1[2], component, data).value);
                    }
                }
                var options = $this.data("bind-options");
                if (options) {
                    var val = component.parseStructure(options, component, data).value;
                    $this.val(val);
                }
                var prop = $this.data("bind-prop");
                if (prop) {
                    $this.data("bind-prop", null);
                    component.processBindProp($this, prop, component, data);
                }
                var prop1 = $this.data("bind-prop1");
                if (prop1) {
                    $this.data("bind-prop1", null);
                    component.processBindProp($this, prop1, component, data);
                }
                var prop2 = $this.data("bind-prop2");
                if (prop1) {
                    $this.data("bind-prop2", null);
                    component.processBindProp($this, prop2, component, data);
                }
                var prop3 = $this.data("bind-prop3");
                if (prop3) {
                    $this.data("bind-prop3", null);
                    component.processBindProp($this, prop3, component, data);
                }
                var style = $this.data("bind-style");
                if (style) {
                    console.warn("JSPA:: bind-style called use bind-load instead function: ", style);
                    $this.data("bind-style", null);
                    if (!$this.data("bind-load"))
                        $this.data("bind-load", style);
                }
                var load = $this.data("bind-load");
                if (load) {
                    $this.data("bind-load", null);
                    var func = load.split("(");
                    var val = component.functionVal(load, component, data);
                    if (component[func[0]])
                        component[func[0]](new JSPAEvent({ $el: $this, component: component, data: data, value: val, evt: new $.Event("load") }));
                    else
                        console.warn("data-bind-load on " + component.constructor.name + " assigned to non-existant method: ", { method: func[0], component: component });
                }
                var click = $this.data("bind-click");
                if (click) {
                    component.bindJSPAEvent(component, $this, "click", click, data);
                }
                var mouse = $this.data("bind-mouse");
                if (mouse) {
                    component.bindJSPAEvent(component, $this, "mousemove", mouse, data);
                }
                var change = $this.data("bind-change");
                if (change) {
                    component.bindJSPAEvent(component, $this, "change", change, data);
                }
                var keydown = $this.data("bind-keydown");
                if (keydown) {
                    component.bindJSPAEvent(component, $this, "keydown", keydown, data);
                }
                var keyup = $this.data("bind-keyup");
                if (keyup) {
                    component.bindJSPAEvent(component, $this, "keyup", keyup, data);
                }
                var blur_1 = $this.data("bind-blur");
                if (blur_1) {
                    component.bindJSPAEvent(component, $this, "blur", blur_1, data);
                }
            }
            catch (ex) {
                console.log("Component.bind().processEl() ERROR: ", { error: ex, component: component, data: data });
            }
            return true;
        }
        walk($template);
        $template.find(".dom-remove").remove();
    };
    Component.prototype.bindJSPAEvent = function (component, $this, type, bindEvent, data) {
        $this.data("bind-" + type, null);
        $this.attr("data-bind-" + type, null);
        var func = bindEvent.split("(");
        var val = component.functionVal(bindEvent, component, data);
        $this.on(type, function (evt) {
            if (component[func[0]])
                component[func[0]](new JSPAEvent({ $el: $this, component: component, data: data, value: val || evt.which, evt: evt }));
            else
                console.warn("data-bind-" + type + " on " + component.constructor.name + " assigned to non-existant method", { method: func[0], component: component });
        });
    };
    Component.prototype.processBindProp = function ($this, prop, component, data) {
        var conf = prop.split(":");
        var property = conf[0];
        conf.splice(0, 1);
        conf = conf.join(":");
        var booleanAttr = false;
        for (var b = 0; b < component.htmlBooleanAttrs.length; b++) {
            if (component.htmlBooleanAttrs[b] == property) {
                booleanAttr = true;
                break;
            }
        }
        if (booleanAttr) {
            if (conf.indexOf("is(") == 0 || conf.indexOf("not(") == 0) {
                var comparison = component.processBindComparison(conf, component, data);
                $this.prop(property, comparison);
            }
            else {
                var val = component.textMultiMatch(conf, component, data).toLowerCase();
                $this.prop(property, val == "true");
            }
        }
        else
            $this.attr(property, component.textMultiMatch(conf, component, data));
    };
    Component.prototype.processBindComparison = function (conf, component, data) {
        if (conf.indexOf("is(") == 0 || conf.indexOf("not(") == 0) {
            var variables = /\((.*?)\)/.exec(conf)[1].split(",");
            var val1 = component.textMultiMatch(variables[0], component, data);
            var val2 = component.textMultiMatch(variables[1], component, data);
            if (conf.indexOf("is(") == 0) {
                return (val1 == val2);
            }
            else {
                return (val1 != val2);
            }
        }
        else
            return null;
    };
    Component.prototype.tabControl = function ($el) {
        $el.find(".nav-item").click(function (evt) {
            var $navLink = $(this).find(".nav-link");
            $(this).siblings().find(".nav-link").removeClass("active");
            $navLink.addClass("active");
            var $target = $el.next(".tab-content").find("#" + $navLink.data("target"));
            $target.siblings().addClass("collapse");
            $target.removeClass("collapse");
        });
    };
    Component.prototype.checkEl = function ($el, data) {
        var options = $el.data("bind-options");
        if (options) {
            return this.parseStructure(options, this, data);
        }
        var prop = $el.data("bind-prop");
        if (prop && prop.split(":")[0] == "value") {
            this.placeHolderExr.lastIndex = 0;
            var match = this.placeHolderExr.exec(prop.split(":")[1]);
            return this.parseStructure(match[2], this, data);
        }
        ;
    };
    Component.prototype.dataChanged = function ($el, data) {
        var reply = { changed: false, oldVal: null, newVal: null };
        reply.newVal = $el.val();
        reply.oldVal = this.checkEl($el, data).value;
        reply.changed = (reply.newVal != reply.oldVal);
        return reply;
    };
    Component.prototype.updateFromUI = function ($el, data) {
        if (!this.dataChanged($el, data).changed)
            return null;
        var stuff = this.checkEl($el, data);
        stuff.ref[stuff.variable] = $el.val();
        return stuff;
    };
    Component.prototype.readBoundValueAttributes = function ($el) {
        var reply = {};
        if (!$el)
            $el = this.$view;
        var $inputs = $el.find(".jspa-data-bound");
        $inputs.each(function () {
            var $this = $(this);
            var src = $this.data("value-src").split(".");
            var obj = reply;
            for (var s = 0; s < src.length; s++) {
                if (s == src.length - 1)
                    obj[src[s].split("|")[0]] = $this.val();
                else {
                    if (!obj[src[s]])
                        obj[src[s]] = {};
                    obj = obj[src[s]];
                }
            }
        });
        return reply;
    };
    Component.prototype.switchChevron = function (src) {
        src.$el.find("i").toggleClass("fa-chevron-down fa-chevron-up");
    };
    return Component;
}());
var Template = (function () {
    function Template(path, name) {
        this.url = null;
        this.name = null;
        this.content = null;
        this.loaded = false;
        this.url = path;
        this.name = name || "content";
    }
    return Template;
}());
var LocalDB = (function () {
    function LocalDB() {
    }
    LocalDB.prototype.store = function (name, data) {
        var written = [];
        var _localDB = this;
        function extend(item) {
            var internal = {
                signature: _localDB.createDataHash(item),
                writtenAt: moment().utc().format("YYYY-MM-DDTHH:mm:ss")
            };
            return $.extend({}, internal, item);
        }
        var writeArray = [];
        if ($.isArray(data))
            writeArray = data;
        else
            writeArray.push(data);
        var checkingForChanges = [];
        for (var i = 0; i < writeArray.length; i++) {
            writeArray[i] = extend(writeArray[i]);
            checkingForChanges.push(this.checkForChanges(name, writeArray[i]));
        }
        var changed = false;
        return Promise.all(checkingForChanges).then(function (reply) {
            for (var w = 0; w < reply.length; w++) {
                if (reply[w].changed) {
                    changed = true;
                }
            }
            var dbPromise = idb.open(config.database.name);
            dbPromise.then(function (db) {
                var tx = db.transaction(name, "readwrite");
                var store = tx.objectStore(name);
                for (var w = 0; w < reply.length; w++) {
                    if (reply[w].changed) {
                        store.put(reply[w].data);
                    }
                }
                return tx.complete;
            });
            return { changed: changed, data: data };
        });
    };
    LocalDB.prototype.checkForChanges = function (name, data) {
        var keypath;
        for (var db in config.database.stores) {
            if (db === name) {
                keypath = config.database.stores[db].key.keyPath;
                if (!$.isArray(keypath))
                    keypath = [keypath];
                break;
            }
        }
        return this.retrieve(name, function (item) {
            var matched = true;
            for (var k in keypath) {
                if (item.value[keypath[k]] !== data[keypath[k]])
                    matched = false;
            }
            if (matched)
                return item.value;
        }).then(function (records) {
            if (!records[0] || records[0].signature != data.signature) {
                return { changed: true, data: data };
            }
            else {
                return { changed: false, data: data };
            }
        });
    };
    ;
    LocalDB.prototype.retrieve = function (name, search) {
        return new Promise(function (resolve) {
            var reply = [];
            var readCursor = function (cursor) {
                if (!cursor) {
                    return;
                }
                var find = search(cursor);
                if (find)
                    reply.push(find);
                return cursor.continue().then(readCursor);
            };
            var dbPromise = idb.open(config.database.name);
            dbPromise.then(function (db) {
                var tx = db.transaction(name, 'readonly');
                var store = tx.objectStore(name);
                return store.openCursor();
            }).then(function (cursor) {
                return readCursor(cursor);
            }).then(function () {
                resolve(reply);
            }).catch(function () {
                resolve(reply);
            });
        });
    };
    LocalDB.prototype.createDataHash = function (data) {
        var str = JSON.stringify(data);
        var hash = 0, i, chr;
        if (str.length === 0)
            return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    };
    return LocalDB;
}());
var LocalStore = (function () {
    function LocalStore(type) {
        switch (type) {
            case "session":
                this._store = window.sessionStorage;
                break;
            case "local":
                this._store = window.localStorage;
                break;
            default:
                this.error("ERROR: Unsupported store type passed to LocalStore");
                break;
        }
    }
    LocalStore.prototype.error = function (msg) {
        if (console.error)
            console.error(msg);
        else
            console.log(msg);
    };
    LocalStore.prototype.setItem = function (key, data) {
        if (!this._store)
            return this.error("ERROR: Data being set to an uninitilized LocalStore");
        var json = JSON.stringify(data);
        this._store.setItem(key, json);
    };
    LocalStore.prototype.getItem = function (key) {
        if (!this._store)
            return this.error("ERROR: Data being retrieved from an uninitilized LocalStore");
        var data = JSON.parse(this._store.getItem(key));
        return data;
    };
    LocalStore.prototype.removeItem = function (key) {
        if (!this._store)
            return this.error("ERROR: Data being removed from an uninitilized LocalStore");
        this._store.removeItem(key);
    };
    return LocalStore;
}());
var JSPAEvent = (function () {
    function JSPAEvent(obj) {
        this.$el = null;
        this.component = null;
        this.data = null;
        this.value = null;
        this.evt = null;
        var _internal = obj;
        for (var m in this) {
            this[m] = _internal[m];
        }
    }
    return JSPAEvent;
}());
;
var JSPAColour = (function () {
    function JSPAColour() {
        this.hex = null;
        this.rgb = null;
        this.r = null;
        this.g = null;
        this.b = null;
    }
    return JSPAColour;
}());
var JSPAEmit = (function () {
    function JSPAEmit(src, data, $parent, error) {
        this.src = src || null;
        this.data = data || null;
        this.$parent = $parent || null;
        this.error = error || null;
    }
    return JSPAEmit;
}());
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var JSPATests = (function (_super) {
    __extends(JSPATests, _super);
    function JSPATests() {
        return _super.call(this, "QUnit.html") || this;
    }
    JSPATests.prototype.draw = function () {
        var _this = this;
        return new Promise(function (resolve) {
            var $page = _this.getTemplate("content");
            resolve($page);
        });
    };
    JSPATests.prototype.drawn = function () {
        console.log("IN DRAWN(): ");
        var that = this;
        var wtf = null;
        function doTest() {
            console.log("testing QUnit");
            if (!window["QUnit"]) {
                window.setTimeout(function () { doTest(); }, 1);
                return;
            }
            that.runAllTests();
        }
        doTest();
    };
    JSPATests.prototype.runAllTests = function () {
        QUnit.test("Test test", function (t) {
            t.equal(1 == 1, true, "Simple equal");
        });
        this.routingTests();
        QUnit.done(function () {
            console.log("Finished all tests");
            $("#application a").each(function (a) {
                var href = $(this).attr("href");
                $(this).attr("href", href.replace("?", "#qunit/?"));
            });
            delete window["QUnit"];
        });
        QUnit.start();
    };
    JSPATests.prototype.routingTests = function () {
        QUnit.test("Routing", function (t) {
            for (var r = 0; r < app.routing.routes.length; r++) {
                var expected = {};
                var route = app.routing.routes[r];
                var parts = route.path.split("/");
                var path = "";
                var value = null;
                for (var p = 0; p < parts.length; p++) {
                    value = null;
                    if (parts[p].indexOf("?") == 0) {
                        var pair = parts[p].split(":");
                        switch (pair[1]) {
                            case "number":
                                value = app.utils.randomNum(true);
                                break;
                            case "string":
                                value = pair[1];
                                break;
                            case "query":
                                value = "?int=" + app.utils.randomNum(true) + "&float=" + app.utils.randomNum() + "&string=" + pair[1];
                        }
                        expected[pair[0].replace("?", "")] = value || pair[1];
                    }
                    if (p > 0)
                        path += "/";
                    path += value || parts[p];
                }
                t.deepEqual(app.routing.routes[r].test(path), expected, route.path + " :: " + path);
            }
        });
    };
    return JSPATests;
}(Component));
var Route = (function () {
    function Route(pth, cmpnnt, instance) {
        this.numberExpr = "[0-9]{1,}";
        this.stringExpr = "[0-9a-z\-]{1,}";
        this.queryExp = "\\?(([a-z]{1,}=[a-zA-Z0-9\-\.\+\=]{1,}&?)&?)+";
        this.path = pth;
        this.srcComponent = cmpnnt;
        if (typeof (instance) == "undefined")
            this.component = new this.srcComponent();
        else
            this.component = instance;
        var expr = "^";
        var parts = pth.split("/");
        for (var p = 0; p < parts.length; p++) {
            if (p > 0)
                expr += "\\/";
            if (parts[p].indexOf("?") == 0) {
                expr += "(";
                if (parts[p].indexOf(":number") >= 0)
                    expr += this.numberExpr;
                else if (parts[p].indexOf(":query") >= 0)
                    expr += this.queryExp;
                else
                    expr += this.stringExpr;
                expr += ")";
            }
            else
                expr += parts[p];
        }
        expr += "$";
        this._expr = RegExp(expr, "i");
    }
    Route.prototype.test = function (path) {
        var match = this._expr.exec(path);
        if (config.verboseMessages) {
            console.log("VERBOSE:: Route.test(): ", { expr: this._expr, path: path });
        }
        if (match == null)
            return null;
        var params = {};
        var parts = this.path.split("/");
        var urlParts = path.split("/");
        for (var p = 0; p < parts.length; p++) {
            if (parts[p].indexOf("?") == 0) {
                var format = parts[p].split(":");
                var val = (format[1] == "number" ? parseInt(RegExp(this.numberExpr, "i").exec(urlParts[p])[0])
                    : (format[1] == "string" ? RegExp(this.stringExpr, "i").exec(urlParts[p])[0]
                        : RegExp(this.queryExp, "i").exec(urlParts[p])[0]));
                params[format[0].substr(1)] = val;
            }
        }
        return params;
    };
    return Route;
}());
var ActiveRoute = (function () {
    function ActiveRoute() {
    }
    return ActiveRoute;
}());
var Routing = (function () {
    function Routing(config) {
        this.activeRoutes = [];
        this.history = [];
        this.routes = config;
    }
    Routing.prototype.getState = function (href) {
        return href.split("#")[1] || "";
    };
    Routing.prototype.logState = function (href) {
        var state = this.getState(href);
        this.history.push(state);
        return href;
    };
    Routing.prototype.changeState = function (position) {
        var curr = this.getState(document.location.href);
        var index = (this.history.length - 1) + position;
        if (position === 0) {
            if (this.history.length == 0 || (this.history[index] && this.history[index] != curr))
                return this.logState(curr);
            return curr;
        }
        if ($.type(this.history[index]) === "string")
            return this.history[index];
        return null;
    };
    Routing.prototype.findRoute = function (path) {
        for (var i = 0; i < this.routes.length; i++) {
            var args = this.routes[i].test(path);
            if (args != null) {
                return this.routes[i];
            }
        }
    };
    Routing.prototype.setActiveRoute = function ($el, route) {
        for (var r = 0; r < this.activeRoutes.length; r++) {
            if ($el.attr("id") == this.activeRoutes[r].$el.attr("id")) {
                this.activeRoutes[r].route.component.blur();
                this.activeRoutes[r].route = route;
                this.activeRoutes[r].$el = $el;
                return;
            }
        }
        this.activeRoutes.push({ $el: $el, route: route });
        return;
    };
    Routing.prototype.getActiveRoute = function ($el) {
        for (var r = 0; r < this.activeRoutes.length; r++) {
            if ($el.attr("id") == this.activeRoutes[r].$el.attr("id"))
                return this.activeRoutes[r];
        }
        return null;
    };
    Routing.prototype.drawStaticRoute = function ($el, path) {
        var staticRoute = app.routing.findRoute(path);
        this.setActiveRoute($el, staticRoute);
        staticRoute.component.draw({}).then(function ($content) {
            $el.append($content);
        });
    };
    Routing.prototype.updateUrlWithoutNavigating = function (newUrl) {
        app.navigateOnHashChange = false;
        history.replaceState({}, "", newUrl);
        app.navigateOnHashChange = true;
    };
    Routing.prototype.navigate = function (state) {
        var _this = this;
        var path = state.split("^")[0];
        console.log("Navigate to: " + path);
        var _loop_2 = function (i) {
            var args = this_2.routes[i].test(path);
            if (args != null) {
                document.location.hash = state;
                $("body").css({ overflowY: "auto" });
                this_2.routes[i].component.draw(args).then(function ($content) {
                    _this.setActiveRoute($("#" + config.contentElementId), _this.routes[i]);
                    $("#" + config.contentElementId).empty().append($content);
                    _this.routes[i].component.postDraw();
                }).catch(function () { });
                return { value: void 0 };
            }
        };
        var this_2 = this;
        for (var i = 0; i < this.routes.length; i++) {
            var state_2 = _loop_2(i);
            if (typeof state_2 === "object")
                return state_2.value;
        }
        this.routes[0].component.draw({ code: 404, text: "Page not found" }).then(function ($content) {
            $("#" + config.contentElementId).replaceWith($("<div id= '" + config.contentElementId + "' />").append($content));
        });
    };
    return Routing;
}());
var AppFooter = (function (_super) {
    __extends(AppFooter, _super);
    function AppFooter() {
        return _super.call(this, { url: "Components/app-footer/app-footer.html", name: "footer" }) || this;
    }
    AppFooter.prototype.draw = function (args) {
        var $template = this.getTemplate("footer");
        return new Promise(function (resolve) { resolve($template); });
    };
    return AppFooter;
}(Component));
var AppHeader = (function (_super) {
    __extends(AppHeader, _super);
    function AppHeader() {
        return _super.call(this, { url: "Components/app-header/app-header.html", name: "navigation" }) || this;
    }
    AppHeader.prototype.draw = function (args) {
        var $template = this.getTemplate("navigation");
        return new Promise(function (resolve) {
            resolve($template);
        });
    };
    ;
    AppHeader.prototype.updatePrimaryNav = function (links) {
        if (!links)
            links = [];
        links.unshift({ url: "#", text: "Home" });
        var $el = this.$view.find("ul.navbar-nav.mr-auto");
        $el.empty();
        for (var l = 0; l < links.length; l++) {
            if (!$.isArray(links[l].url)) {
                $el.append($("<li />").addClass("nav-item" + (document.location.hash.replace("#", "") == links[l].url.replace("#", "") ? " active" : ""))
                    .append($("<a />").addClass("nav-link")
                    .attr("href", links[l].url)
                    .text(links[l].text)));
            }
            else {
                var $li = $("<li />").addClass("nav-item dropdown")
                    .append($("<li />").addClass("nav-link dropdown-toggle ")
                    .attr("role", "button")
                    .attr("data-toggle", "dropdown")
                    .text(links[l].text))
                    .append($("<div />").addClass("dropdown-menu"));
                for (var dd = 0; dd < links[l].url.length; dd++) {
                    $li.find("div")
                        .append($("<a />").addClass("dropdown-item")
                        .attr("href", links[l].url[dd].href)
                        .text(links[l].url[dd].text));
                }
                $el.append($li);
            }
        }
    };
    AppHeader.prototype.keydown = function (src) {
        if (src.evt.which === 13)
            this.search(src);
    };
    AppHeader.prototype.search = function (src) {
        var pattern = this.$view.find("#header-search").val();
        document.location.href = "#site-info/search/" + pattern;
    };
    AppHeader.prototype.componentExtra = function (src) {
        var url = document.location.href.split("#")[1];
        var component = url.split("/")[0];
        switch (component) {
            case "site-info":
                var siteId = config.utils.toNumber(url.split("/")[1]);
                if (siteId)
                    document.location.href = "#site-admin/" + siteId;
        }
    };
    AppHeader.prototype.toggleSubscriptions = function (src) {
        if (src.value == "pause") {
            config.api.pauseSubscriptions();
            toastr.warning("All subscriptions paused", "Paused data subscriptions");
        }
        else {
            config.api.resumeSubscriptions();
            toastr.success("All subscriptions resumed", "Resumed data subscriptions");
        }
    };
    return AppHeader;
}(Component));
var Component1 = (function (_super) {
    __extends(Component1, _super);
    function Component1() {
        var _this = _super.call(this, [
            { url: "Components/component-1/component-1.html", name: "master" },
        ]) || this;
        _this.dataStore = {
            code: null,
            template: null
        };
        return _this;
    }
    Component1.prototype.draw = function (args) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var calls = [];
            calls.push(fetch("Components/component-1/component-1.ts").then(function (response) {
                return response.text();
            }).then(function (body) {
                _this.dataStore.code = body;
            }));
            calls.push(fetch("Components/component-1/component-1.html").then(function (response) {
                return response.text();
            }).then(function (body) {
                _this.dataStore.template = body;
            }));
            Promise.all(calls).then(function () {
                _this.$view.replaceWith(_this.render());
                _this.$view.find("pre code").each(function (i, block) {
                    hljs.highlightBlock(block);
                });
            });
            resolve(_this.render());
        });
    };
    Component1.prototype.render = function () {
        if (this.dataStore.code && this.dataStore.template) {
            var $page = this.getTemplate("master");
            return $page;
        }
        return this.waitOnData();
    };
    return Component1;
}(Component));
var ClientError = (function (_super) {
    __extends(ClientError, _super);
    function ClientError() {
        var _this = _super.call(this, [
            { url: "Components/error/4xx.html", name: "4xx" },
            { url: "Components/error/401.html", name: "401" },
            { url: "Components/error/403.html", name: "403" },
            { url: "Components/error/404.html", name: "404" }
        ]) || this;
        _this.$template = $("\n    <app-component>\n    <h1>Error</h1>\n    <div>{{ code }} - {{ text }}</div>\n    <a href=''>Go Home</a>\n    <app-component />\n    ");
        return _this;
    }
    ClientError.prototype.draw = function (args) {
        var _this = this;
        this.setTitle("Error");
        if (!this.hasTemplate(args.code)) {
            var $template_1 = this.getTemplate("4xx", args);
            return new Promise(function (resolve) { resolve($template_1); });
        }
        else {
            if (args.code == 401)
                this.setTitle("Login");
            return new Promise(function (resolve) {
                var $template = _this.getTemplate(args.code);
                resolve($template);
            });
        }
    };
    ClientError.prototype.login = function () {
        var user = this.$view.find("#401-user").val();
        var password = this.$view.find("#401-password").val();
        config.api.auth({
            EmailAddress: "berty.biscuit@bertybiscuits.co.uk",
            Password: "Sausages",
            PhoneNumber: null
        }).then(function () {
            if (document.location.hash.indexOf("#error/") === 0)
                app.routing.navigate('');
            else {
                var state = app.routing.changeState(0);
                app.routing.navigate(state);
            }
        }).catch(function () {
            app.routing.navigate('');
        });
    };
    return ClientError;
}(Component));
var Home = (function (_super) {
    __extends(Home, _super);
    function Home() {
        var _this = _super.call(this, [
            { url: "Components/home/home.html", name: "home" },
        ]) || this;
        _this.dataStore = null;
        return _this;
    }
    Home.prototype.render = function () {
        if (typeof (this.dataStore) != "undefined") {
            var $page = this.getTemplate("home");
            return $page;
        }
        return this.waitOnData();
    };
    Home.prototype.draw = function (args) {
        var _this = this;
        this.setTitle("CRT MEICA / SCADA");
        return new Promise(function (resolve) {
            _this.dataStore = [];
            resolve(_this.render());
        });
    };
    ;
    return Home;
}(Component));
//# sourceMappingURL=application.js.map