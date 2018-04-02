/// <reference path="../Services/pipes.ts" />

abstract class Component {
    
    public $view: JQuery;
    protected formater: Pipes = new Pipes();
    protected parent: string = null;
    protected id: string;
    private subscriptions: string[] = [];
    private htmlBooleanAttrs: string[] = [
    'checked','selected','disabled','readonly','multiple','ismap','noresize'];

    constructor(templates?: any, parent?: Component) {

        this.id = app.utils.createUUID();

        if(templates)
            this.loadTemplate(templates);

        if (parent) {
            this.parent = app.utils.createUUID();
            app.recievers[this.parent] = parent;
        }
    }

    abstract draw(args?: any)

    public blur(route?: Route): void {
        for (let s = 0; s < this.subscriptions.length; s++)
            this.unsubscribe(this.subscriptions[s]);
        // unbind all the jquery
        this.$view.empty();
        if (route) {
            // refresh the Componant
            route.component = new route.srcComponent();
        }

    }
    
    public postDraw() {
        this.drawn();
    } 
    protected drawn() {
        // the extending class can impliment this if it wants to
    }
    

    protected subscribe(path: string, handler: any, options: ApiRequestOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            let ref = config.api.subscribe(path, handler, options);
            this.subscriptions.push(ref);
            resolve(ref);
        });
    }
    protected unsubscribe(ref: string): void {
        for (let s = 0; s < this.subscriptions.length; s++) {
            if (this.subscriptions[s] == ref) {
                config.api.unsubscribe(this.subscriptions[s]);
                this.subscriptions.splice(s, 1);
            }
        }
    }
    
    protected recieve(data: any): void {
        console.log("Recieved data, but " + this.constructor.name + " doesn't impliment recieve():", data)
    }

    protected emit(data: any): void {
        let reply = {
            src: this.constructor.name,
            data: data
        };
        if (this.parent) {
            //console.log("Component.emit(): ", { parent: this.parent, recievers: app.recievers, data: reply, obj: this });
            app.recievers[this.parent].recieve(reply);
        }
    }

    public $templates: Template[] = [];

    public waitingOnAsync(): boolean {
        for (let t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].loaded === false)
                return true;
        }
        return false;
    }

    protected setTitle(title: string): void {
        document.title = title;
    }

    protected hasTemplate(search: string): boolean {
        for (let t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].name == search) {
                return true;
            }
        }
        return false;
    }

    private waitTimeout: number = null;
    protected waitOnData(): JQuery {
        let waitCount = 0;
        let id = app.utils.createUUID();
        let message = "Waiting on data";
        this.$view = $("<app-waiting style='padding: 5px;' />").attr("id", id).append($("<h1 />").text(message));
        
        let updateMsg = function () {
            if (waitCount < 10) {
                waitCount++;
                this.waitTimeout = window.setTimeout(() => {
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
                        })
                    )
                    .find($("h1")).text("No data recieved")
            }
        }
        updateMsg();

        return this.$view;
    }

    protected getTemplate(search: string, data?: any): JQuery {
        // if we are waiting, then clear it.
        if (this.waitTimeout != null) {
            window.clearTimeout(this.waitTimeout);
            this.waitTimeout = null;
        }

        let component = this;
        for (let t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].name == search) {
                this.$view = this.$templates[t].content.clone();
                this.bind(this.$view, $.extend({}, component, data || {}));

                return this.$view;
            }
        }
        return $("<app-notfound />");
    }
    // just don't bind the view
    protected getSubTemplate(search: string, data?: any): JQuery {
        let component = this;
        for (let t = 0; t < this.$templates.length; t++) {
            if (this.$templates[t].name == search) {
                let $view = this.$templates[t].content.clone();
                this.bind($view, $.extend({}, component, data || {}));

                return $view;
            }
        }
        return $("<app-notfound />");
    }
    
    protected loadTemplate(input: any) {
        // singleton - make it an array
        if ($.type(input) !== "array") {
            let temp = input;
            input = [];
            input.push(temp);
        }

        // array
        for (let t = 0; t < input.length; t++) {
            let template;
            if ($.type(input[t]) === "string")
                template = new Template(input[t]);
            else
                template = new Template(input[t].url, input[t].name);

            this.$templates.push(template);
            (function (template) {
                fetch(template.url).then((response) => {
                    return response.text();
                }).then((body) => {
                    template.content = $("<app-" + template.name + " />").append($(body));
                    template.loaded = true;
                });
            })(template);
        }   
    }

    private placeHolderPattern: string = "{{([\w]*) (.*?) }}";
    private placeHolderExr: RegExp = new RegExp("{{([\w]*) (.*?) }}", "g");
    private arrayExr: RegExp = new RegExp("\\[([0-9]{1,})(.*?)\\]", "g");
    
    private parseStructure(strut, component, data): { ref: any, variable: string, value: string } {
        //console.log("Component.parseStructure() in: ", { strut: strut, data: data });
        let reply = { ref: data, variable: null, value: null };
        try {
            let pipes = strut.split("|");
            // first pull out the value..
            let parts = pipes[0].split(".");
            let stuff = JSON.clone(data);
            let arr = null;
            for (let p = 0; p < parts.length; p++) {
                // reset the last index to 0 - otherwise we only ever match the first array[0]
                component.arrayExr.lastIndex = 0;
                
                reply.variable = parts[p];

                // arrays
                if ((arr = component.arrayExr.exec(parts[p])) != null) {
                    stuff = stuff[parts[p].replace(arr[0], "")][arr[1]];

                    if (p < (parts.length - 1))
                        reply.ref = reply.ref[parts[p].replace(arr[0], "")][arr[1]];
                }
                else {
                    // check it exists on `data`
                    if (typeof(stuff[parts[p]]) == "undefined") {
                        console.log(parts[p] + " not found in object: ", stuff);
                        return reply;
                    }

                    stuff = stuff[parts[p]];

                    if (p < (parts.length - 1))
                        reply.ref = reply.ref[parts[p]];
                }
            }
            // then pass it though any pipes
            reply.value = stuff;
            for (let pipe = 1; pipe < pipes.length; pipe++) {
                // error - took me ages to find
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
        //console.log("Component.parseStructure() out: ", { strut: strut, data: data });
        return reply;   
    }

    private textMultiMatch(content, component, data) {

        //console.log("textMultiMatch(): ", { content: content, component: component, data: data });
        let match = null;
        let matches: { pattern: string, value: string }[] = [];
        let regEx = new RegExp(component.placeHolderPattern, "g");
        while ((match = regEx.exec(content)) != null) {
            let thisMatch = {
                pattern: "{{ " + match[2] + " }}",
                value: this.parseStructure(match[2], component, data).value
            }
            matches.push(thisMatch);            
        }
        for (let m = 0; m < matches.length; m++)
        {
            content = content.replace(matches[m].pattern, matches[m].value);
        }
        return content;
    }
    private functionVal(callSignature, component, data) {

        // do we have parameters
        let func = callSignature.split("(");
        let val = null;
        if (func[1])
            val = this.textMultiMatch(func[1].substr(0, func[1].length - 1), component, data);
        return val;
    }
    
    protected bind($template: JQuery, data: any): void {

        let bindref = new Utils().createUUID();
        let component = this;
        
        function walk($el: JQuery) {
            processEl($el);
            $el = $el.children().first();
            while ($el.length) {
                walk($el);
                $el = $el.next();
            }
        }
        function processEl($el: JQuery) {
            let $this = $el;
            try {
                // process?
                let cont = $this.data("bind-if");
                if (cont) {
                    if (!component.parseStructure(cont, component, data).value ? true : false) {
                        // stop walking, but mark this node for deletion.... this is to keep the structure intact otherwise .next() isn't there.
                        $this.addClass("dom-remove");
                        return;
                    }
                }

                // in line templates, has to be first - once we know we are doing anything, as the contents get popped off.
                let multiple = $this.data("bind-for");
                if (multiple) {
                    $this.data("bind-for", null);
                    (function ($this: JQuery, multiple: string, component: any, data: any) { 
                        let $template = $this.children().clone();
                        let info = component.parseStructure(multiple, component, data);
                        // clear out the holder
                        $this.empty();
                    
                        if (!info.value)
                            return;

                        (function ($this: any, $template: JQuery, info: any) {
                            for (let i = 0; i < info.length; i++) {
                                let $new = $template.clone();
                                info[i].JSPA = i;
                                component.bind($new, info[i]);
                                $this.append($new);
                            }
                        })($this, $template, info.value);

                    })($this, multiple, component, data);
                    
                    //return;
                }


                // text content
                let textNodes = $this.textNodes();
                let match = null;
                let arr = null;
                for (let n = 0; n < textNodes.length; n++) {
                    let content = textNodes[n].nodeValue;
                    textNodes[n].nodeValue = component.textMultiMatch(content, component, data);
                }

                // value attribute
                let valueAttribute = $this.val();
                if (valueAttribute) {
                    // if it doesn't match the pattern {{ stuff }} then just move along
                    let valueExpr = new RegExp(component.placeHolderPattern, "g");
                    let match = valueExpr.exec(valueAttribute);
                    if (match) {
                        $this.addClass("jspa-data-bound");
                        $this.data("value-src", match[2]);
                        $this.val(component.parseStructure(match[2], component, data).value);
                    }
                }

                // <options />
                let options = $this.data("bind-options");
                if (options) {
                    let val = component.parseStructure(options, component, data).value;
                    $this.val(val);
                }

                // prop
                let prop = $this.data("bind-prop");
                if (prop) {
                    $this.data("bind-prop", null);
                    let conf = prop.split(":");
                    // incase the value has : in it .join(":")
                    let property = conf[0];
                    conf.splice(0, 1)
                    conf = conf.join(":");
                    // is this a boolean attribute?
                    let booleanAttr = false;
                    for (let b = 0; b < component.htmlBooleanAttrs.length; b++){
                        if (component.htmlBooleanAttrs[b] == property) {
                            booleanAttr = true;
                            break;
                        }
                    }
                    if (booleanAttr) {
                        let val = component.textMultiMatch(conf, component, data);
                        $this.prop(property, val=="true");
                    }
                    else
                        $this.attr(property, component.textMultiMatch(conf, component, data));
                }

                // class
                let style = $this.data("bind-style");
                if (style) {
                    $this.data("bind-style", null);
                    let func = style.split("(");
                    let val = component.functionVal(style, component, data);
                    if (component[func[0]])
                        component[func[0]]({ $el: $this, component: component, data: data, value: val });
                    else
                        console.log("data-bind-style on " + component.constructor.name + " assigned to non-existant method: ", { method: func[0], component: component });
                }

                // click events
                let click = $this.data("bind-click");
                if (click) {
                    $this.data("bind-click", null);
                    let func = click.split("(");
                    let val = component.functionVal(click, component, data);
                    $this.click(function (evt) {
                        if (component[func[0]]) {
                            component[func[0]](new JSPAEvent({ $el: $this, component: component, data: data, value: val, evt: evt }));
                        }
                        else
                            console.log("data-bind-click on " + component.constructor.name + " assigned to non-existant method: ", { method: func[0], component: component });
                    });
                }

                // change events
                let change = $this.data("bind-change");
                if (change) {
                    $this.data("bind-change", null);
                    let func = change.split("(");
                    let val = component.functionVal(change, component, data);
                    $this.change(function (evt) {
                        if (component[func[0]])
                            component[func[0]](new JSPAEvent({ $el: $this, component: component, data: data, value: val, evt: evt }));
                        else
                            console.log("data-bind-change on " + component.constructor.name + " assigned to non-existant method: ", { method: func[0], component: component });
                    });
                }

                // key-press
                let keydown = $this.data("bind-key");
                if (keydown) {
                    $this.data("bind-key", null);
                    $this.keydown(function (evt) {
                        if (component[keydown])
                            component[keydown](new JSPAEvent({ $el: $this, component: component, data: data, value: evt.which, evt: evt }));
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
        // remove anything flagged for removal
        $template.find(".dom-remove").remove();
        
    }
    // checks if the displayed value of a bound element has changed - data has to be whatever was passed in to the original
    // also only works for attributes bond through data-bind-prop:value, or data-bind-options
    private checkEl($el: JQuery, data: any) {
        let options = $el.data("bind-options");
        if (options) { return this.parseStructure(options, this, data) }

        let prop = $el.data("bind-prop");
        if (prop && prop.split(":")[0] == "value") {
            this.placeHolderExr.lastIndex = 0;
            let match = this.placeHolderExr.exec(prop.split(":")[1]);
            return this.parseStructure(match[2], this, data);
        };
    }

    protected dataChanged($el: JQuery, data: any): { changed: boolean, oldVal: any, newVal: any } {
        let reply = { changed: false, oldVal: null, newVal: null };
        reply.newVal = $el.val();
        reply.oldVal = this.checkEl($el, data).value;
        reply.changed = (reply.newVal != reply.oldVal);
        return reply;
    }
    // also only works for attributes bound through data-bind-prop:value, or data-bind-options
    protected updateFromUI($el: JQuery, data: any): any {
        if (!this.dataChanged($el, data).changed)
            return null;

        let stuff = this.checkEl($el, data);
        stuff.ref[stuff.variable] = $el.val();

        return stuff;
    }
    // works for inputs with a value set
    protected readBoundValueAttributes($el?: JQuery): any {
        let reply = {};
        // if $el not passed in, use the componet.$view
        if (!$el)
            $el = this.$view;

        let $inputs = $el.find(".jspa-data-bound");
        $inputs.each(function () {
            let $this = $(this);
            let src = $this.data("value-src").split(".");
            let obj = reply;
            for (let s = 0; s < src.length; s++)
            {
                if (s == src.length - 1)
                    obj[src[s].split("|")[0]] = $this.val(); // we split on pipe to remove any pipes
                else {
                    if (!obj[src[s]])
                        obj[src[s]] = {};
                    obj = obj[src[s]];
                }   
            }
        });

        return reply;
    }
}
class Template {
    url: string = null;
    name: string = null;
    content: JQuery = null;
    loaded: boolean = false;

    constructor(path: string, name? : string) {
        this.url = path;
        this.name = name || "content";
    }
}