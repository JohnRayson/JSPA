class Route {
    public path: string;
    public component: Component;
    public srcComponent: any;

    private _expr: RegExp;
    private numberExpr: RegExp = RegExp("[0-9]{1,}", "i");
    private stringExpr: RegExp = RegExp("[0-9a-z]{1,}", "i");

    public test(path: string): any {
        let match = this._expr.exec(path);
        if (match == null)
            return null;

        // so it matched - parse off the parameters
        let params = {}
        let parts = this.path.split("/");
        let urlParts = path.split("/");

        for (let p = 0; p < parts.length; p++) {
            // check its actually a parameter first
            if (parts[p].indexOf("?") == 0) {
                let format = parts[p].split(":");
                let val = (format[1] == "number" ? parseInt(this.numberExpr.exec(urlParts[p])[0]) : this.stringExpr.exec(urlParts[p])[0]);
                params[format[0].substr(1)] = val;
            }
        }
        return params;
    }
    
    constructor(pth: string, cmpnnt: any) {
        this.path = pth;
        this.srcComponent = cmpnnt;

        this.component = new this.srcComponent();
        
        // get the sections
        let expr = "^";
        let parts: Array<string> = pth.split("/");
        for (let p = 0; p < parts.length; p++) {
            // add back in the slash
            if (p > 0)
                expr += "\\/";

            // is it a parameter?
            if (parts[p].indexOf("?") == 0) {
                expr += "(";
                // string or number?
                if (parts[p].indexOf(":number") >= 0)
                    expr += "[0-9]{1,}";
                else
                    expr += "[0-9a-z]{1,}";
                expr += ")";
            }
            else // fixed string
                expr += parts[p];
        }
        expr += "$";
        this._expr = RegExp(expr, "i");
    }
}

class ActiveRoute {
    public $el: JQuery;
    public route: Route;
}

class Routing {
    public routes: Route[]
    public activeRoutes: ActiveRoute[] = [];
    private history: string[] = [];

    constructor(config: Route[]) {
        this.routes = config;
    }

    public getState(href: string): string {

        return href.split("#")[1] || "";
    }
    
    public logState(href: string): string {
        let state = this.getState(href);
        this.history.push(state);
        return href;
    }
    // pass a negative number! - zero for now
    public changeState(position: number): string {
        let curr = this.getState(document.location.href);
        let index = (this.history.length - 1) + position;
        
        // special case - current - return what ever is on the URL, if its not also the last thing in the array - add it first
        if (position === 0) {
            if (this.history.length == 0 || (this.history[index] && this.history[index] != curr))
                return this.logState(curr);
            return curr;
        }
        // normal - looking in the history
        if ($.type(this.history[index]) === "string") // "" is falsey - damn it
            return this.history[index];
        return null;
    }

    // find a route - but don't navigate to it
    public findRoute(path: string): Route {
        for (let i = 0; i < this.routes.length; i++) {
            let args = this.routes[i].test(path)
            if (args != null) {
                return this.routes[i];
            }
        }
    }

    public setActiveRoute($el: JQuery, route: Route) {
        // see if the $el already has an active route
        for (let r = 0; r < this.activeRoutes.length; r++) {
            if ($el.attr("id") == this.activeRoutes[r].$el.attr("id")) {
                this.activeRoutes[r].$el = $el;
                // call the blur() method on the existing one
                this.activeRoutes[r].route.component.blur();
                this.activeRoutes[r].route = route;
                return;
            }
        }
        this.activeRoutes.push({ $el: $el, route: route });
        return;
    }

    public getActiveRoute($el: JQuery): ActiveRoute {
        for (let r = 0; r < this.activeRoutes.length; r++) {
            if ($el.attr("id") == this.activeRoutes[r].$el.attr("id"))
                return this.activeRoutes[r];
        }
        return null;
    }

    public drawStaticRoute($el: JQuery, path: string) {
        let staticRoute = app.routing.findRoute(path);

        this.setActiveRoute($el, staticRoute);

        staticRoute.component.draw({}).then(($content) => {
            $el.append($content);
        });
    }


    // find a route and navigate the main content to it
    public navigate(state: any): any {
        let path = state; //Object.keys(state)[0] || "";
        console.log("Navigate to: " + path);

        for (let i = 0; i < this.routes.length; i++) {
            let args = this.routes[i].test(path)
            if (args != null) {
                document.location.hash = state;

                // switch out the active route
                this.routes[i].component.draw(args).then(($content) => {
                    this.setActiveRoute($("#" + config.contentElementId), this.routes[i]);
                    $("#" + config.contentElementId).empty().append($content);
                    //$("#" + config.contentElementId).replaceWith($("<div id= '" + config.contentElementId + "' />").append($content));
                    this.routes[i].component.postDraw();
                });
                return;
            }
        }
        this.routes[0].component.draw({ code: 404, text: "Page not found" }).then(($content) => {
            $("#" + config.contentElementId).replaceWith($("<div id= '" + config.contentElementId + "' />").append($content));
        });
    }
}


    
   