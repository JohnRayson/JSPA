var Config = (function () {
    function Config() {
        this.utils = new Utils();
        this.sessionStore = new LocalStore("session");
        this.api = new Api("");
        this.contentElementId = "application";
        this.routes = [
            new Route("error/?code:number", ClientError),
            new Route("app-header", AppHeader),
            new Route("app-footer", AppFooter),
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
        for (var s = 0; s < this.subscriptions.length; s++)
            this.unsubscribe(this.subscriptions[s]);
        this.$view.empty();
        if (route) {
            route.component = new route.srcComponent();
        }
    };
    Component.prototype.postDraw = function () {
        this.drawn();
    };
    Component.prototype.drawn = function () {
    };
    Component.prototype.subscribe = function (path, handler, options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var ref = config.api.subscribe(path, handler, options);
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
    Component.prototype.emit = function (data) {
        var reply = {
            src: this.constructor.name,
            data: data
        };
        if (this.parent) {
            app.recievers[this.parent].recieve(reply);
        }
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
        this.$view = $("<app-waiting style='padding: 5px;' />").attr("id", id).append($("<h1 />").text(message));
        var updateMsg = function () {
            if (waitCount < 10) {
                waitCount++;
                this.waitTimeout = window.setTimeout(function () {
                    message = message + ".";
                    $("#" + id).find($("h1")).text(message);
                    updateMsg();
                }, 2000);
            }
            else {
                $("#" + id)
                    .append($("<button type='button' class='row btn btn-info' /></button>")
                    .append("<span>Go Back</span>")
                    .click(function () {
                    window.history.back();
                }))
                    .find($("h1")).text("No data recieved");
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
        for (var t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].name == search) {
                this.$view = this.$templates[t].content.clone();
                this.bind(this.$view, $.extend({}, component, data || {}));
                return this.$view;
            }
        }
        return $("<app-notfound />");
    };
    Component.prototype.getSubTemplate = function (search, data) {
        var component = this;
        for (var t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].name == search) {
                var $view = this.$templates[t].content.clone();
                this.bind($view, $.extend({}, component, data || {}));
                return $view;
            }
        }
        return $("<app-notfound />");
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
                    return response.text();
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
                    if (typeof (stuff[parts[p]]) == "undefined") {
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
        if (func[1])
            val = this.textMultiMatch(func[1].substr(0, func[1].length - 1), component, data);
        return val;
    };
    Component.prototype.bind = function ($template, data) {
        var bindref = new Utils().createUUID();
        var component = this;
        function walk($el) {
            processEl($el);
            $el = $el.children().first();
            while ($el.length) {
                walk($el);
                $el = $el.next();
            }
        }
        function processEl($el) {
            var $this = $el;
            try {
                var cont = $this.data("bind-if");
                if (cont) {
                    if (!component.parseStructure(cont, component, data).value ? true : false) {
                        $this.addClass("dom-remove");
                        return;
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
                        var val = component.textMultiMatch(conf, component, data);
                        $this.prop(property, val == "true");
                    }
                    else
                        $this.attr(property, component.textMultiMatch(conf, component, data));
                }
                var style = $this.data("bind-style");
                if (style) {
                    $this.data("bind-style", null);
                    var func = style.split("(");
                    var val = component.functionVal(style, component, data);
                    if (component[func[0]])
                        component[func[0]]({ $el: $this, component: component, data: data, value: val });
                    else
                        console.log("data-bind-style on " + component.constructor.name + " assigned to non-existant method: ", { method: func[0], component: component });
                }
                var click = $this.data("bind-click");
                if (click) {
                    $this.data("bind-click", null);
                    var func_1 = click.split("(");
                    var val_1 = component.functionVal(click, component, data);
                    $this.click(function (evt) {
                        if (component[func_1[0]]) {
                            component[func_1[0]](new JSPAEvent({ $el: $this, component: component, data: data, value: val_1, evt: evt }));
                        }
                        else
                            console.log("data-bind-click on " + component.constructor.name + " assigned to non-existant method: ", { method: func_1[0], component: component });
                    });
                }
                var change = $this.data("bind-change");
                if (change) {
                    $this.data("bind-change", null);
                    var func_2 = change.split("(");
                    var val_2 = component.functionVal(change, component, data);
                    $this.change(function (evt) {
                        if (component[func_2[0]])
                            component[func_2[0]](new JSPAEvent({ $el: $this, component: component, data: data, value: val_2, evt: evt }));
                        else
                            console.log("data-bind-change on " + component.constructor.name + " assigned to non-existant method: ", { method: func_2[0], component: component });
                    });
                }
                var keydown_1 = $this.data("bind-key");
                if (keydown_1) {
                    $this.data("bind-key", null);
                    $this.keydown(function (evt) {
                        if (component[keydown_1])
                            component[keydown_1](new JSPAEvent({ $el: $this, component: component, data: data, value: evt.which, evt: evt }));
                        else
                            console.log("data-bind-key on " + component.constructor.name + " assigned to non-existant method");
                    });
                }
            }
            catch (ex) {
                console.log("Component.bind().processEl() ERROR: ", { error: ex, component: component, data: data });
            }
        }
        walk($template);
        $template.find(".dom-remove").remove();
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
        this.setTitle("JSPA Template");
        return new Promise(function (resolve) {
            _this.dataStore = [];
            resolve(_this.render());
        });
    };
    ;
    return Home;
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
            EmailAddress: user,
            Password: password,
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
    AppHeader.prototype.search = function () {
        var pattern = this.$view.find("#header-search").val();
        document.location.href = "#search/" + pattern;
    };
    return AppHeader;
}(Component));
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
        var api = this;
        return new Promise(function (resolve, reject) {
            resolve(_this.post("auth/authenticate", model));
        }).then(function (reply) {
            api.token = reply.token;
            window.sessionStorage.setItem("token", api.token);
            api.headers["X-Authentication"] = api.token;
            return reply.user;
        });
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
                console.log("Error: ", jqXHR);
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
        request.headers = this.headers;
        request.data = (data != null ? JSON.stringify(data) : null);
        return request;
    };
    Api.prototype.subscribe = function (path, handler, options) {
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
        sub.callbacks.push({ id: ref, func: handler });
        this.localDb.retrieve(options.datastore, function (item) {
            var matched = true;
            for (var member in options.retrieve) {
                if (item.value[member] !== options.retrieve[member])
                    matched = false;
            }
            if (matched) {
                handler(item.value);
            }
        });
        sub.api.get(sub.url, sub.options).then(function (reply) {
            handler(reply);
        });
        if (!sub.started) {
            sub.start();
        }
        return ref;
    };
    Api.prototype.unsubscribe = function (id) {
        console.log("API.unsubscribe(): ", { lookingfor: id, in: this.subsriptions });
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
        this.started = false;
        this.callbacks = [];
        this.statusNot200 = false;
        this.url = path;
        this.api = api;
        this.options = options;
    }
    Subscription.prototype.start = function () {
        var _this = this;
        this.started = true;
        var subOptions = $.extend({}, this.options, { onlyChanges: true });
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
        }, 5000);
    };
    Subscription.prototype.stop = function () {
        console.log("Subscription.stop()");
        this.started = false;
        window.clearInterval(this.interval);
    };
    return Subscription;
}());
var Utils = (function () {
    function Utils() {
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
    Utils.prototype.fullScreenPanelToggle = function (src) {
        src.evt.preventDefault();
        if (src.$el.children('i').hasClass('fa-window-maximize')) {
            src.$el.children('i').removeClass('fa-window-maximize');
            src.$el.children('i').addClass('fa-window-minimize');
        }
        else if (src.$el.children('i').hasClass('fa-window-minimize')) {
            src.$el.children('i').removeClass('fa-window-minimize');
            src.$el.children('i').addClass('fa-window-maximize');
        }
        src.$el.closest('.card').toggleClass('fullscreen-card');
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
    return Utils;
}());
if (typeof JSON.clone !== "function") {
    JSON.clone = function clone(object) {
        return JSON.retrocycle(JSON.parse(JSON.stringify(JSON.decycle(object))));
    };
}
if (typeof console.freeze !== "function") {
    console.freeze = function freeze(message, object) {
        if (object)
            console.info(message, JSON.clone(object));
        else
            console.info(message);
    };
}
var config = null;
var app = null;
var App = (function () {
    function App() {
        this.online = false;
        this.routing = null;
        this.utils = new Utils();
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
            $(window).bind("hashchange", function (e) {
                var state = app.routing.changeState(0);
                app.routing.navigate(state);
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
                console.log("LocalDB.checkForChanges() : ", { stored: records, new: data });
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
var Route = (function () {
    function Route(pth, cmpnnt) {
        this.numberExpr = RegExp("[0-9]{1,}", "i");
        this.stringExpr = RegExp("[0-9a-z]{1,}", "i");
        this.path = pth;
        this.srcComponent = cmpnnt;
        this.component = new this.srcComponent();
        var expr = "^";
        var parts = pth.split("/");
        for (var p = 0; p < parts.length; p++) {
            if (p > 0)
                expr += "\\/";
            if (parts[p].indexOf("?") == 0) {
                expr += "(";
                if (parts[p].indexOf(":number") >= 0)
                    expr += "[0-9]{1,}";
                else
                    expr += "[0-9a-z]{1,}";
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
        if (match == null)
            return null;
        var params = {};
        var parts = this.path.split("/");
        var urlParts = path.split("/");
        for (var p = 0; p < parts.length; p++) {
            if (parts[p].indexOf("?") == 0) {
                var format = parts[p].split(":");
                var val = (format[1] == "number" ? parseInt(this.numberExpr.exec(urlParts[p])[0]) : this.stringExpr.exec(urlParts[p])[0]);
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
                this.activeRoutes[r].$el = $el;
                this.activeRoutes[r].route.component.blur();
                this.activeRoutes[r].route = route;
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
    Routing.prototype.navigate = function (state) {
        var _this = this;
        var path = state;
        console.log("Navigate to: " + path);
        var _loop_2 = function (i) {
            var args = this_2.routes[i].test(path);
            if (args != null) {
                document.location.hash = state;
                this_2.routes[i].component.draw(args).then(function ($content) {
                    _this.setActiveRoute($("#" + config.contentElementId), _this.routes[i]);
                    $("#" + config.contentElementId).empty().append($content);
                    _this.routes[i].component.postDraw();
                });
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
//# sourceMappingURL=application.js.map