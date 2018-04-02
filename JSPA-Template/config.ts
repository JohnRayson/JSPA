
class Config {

    utils: Utils = new Utils();
    sessionStore: LocalStore = new LocalStore("session");
    api: Api = new Api("");

    contentElementId: string = "application";
    
    routes: Route[] = [
        new Route("error/?code:number", ClientError), // must be first
        new Route("app-header", AppHeader),
        new Route("app-footer", AppFooter),
        // actual content pages
        new Route("", Home),
        new Route("component-1", Component1),
    ];

    database: any = {
        name: "jquery-spa",
        version: 1,
        // to add / change stores edit the "stores" object, then increment the version number. This deletes the current stores!
        stores: {
            "jspa": {
                key: { keyPath: "Id" },
                indexes: []
            },
        }
    }
    
    // called after everything has loaded.
    load(app: App): void {
        // bind the header & footer
        app.routing.drawStaticRoute($("#app-navigation"), "app-header");
        app.routing.drawStaticRoute($("#app-footer"), "app-footer");
        
    }

    // any other custom setting
    dateTimePickerDefault = {
        calendarWeeks: true,
        format: "DD/MM/YYYY HH:mm:ss",
        showTodayButton: true,
        showClear: true,
        showClose: true,
    }
}
