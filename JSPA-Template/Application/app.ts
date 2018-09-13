// https://anandnalya.com/2012/03/building-a-single-page-webapp-with-jquery/

/// <reference path="../config.ts" />
/// <reference path="utils.ts" />

var config: Config = null; 
var app: App = null;

class App {
    public online: boolean = false;
    public routing: Routing = null;
    public utils: Utils = new Utils();
    public hasLoaded = false;
    public navigateOnHashChange: boolean = true; // public so the routing can read it..

    private loading: number = null;
    private loaded() {
        // check the components
        if (this.loading != null)
            window.clearTimeout(this.loading);

        for (let r = 0; r < this.routing.routes.length; r++) {
            if (this.routing.routes[r].component.waitingOnAsync()) {
                let that = this;
                this.loading = window.setTimeout(function ()
                { that.loaded() }, 250);
                return;
            }
        }
        // all loaded
        if (config.load)
            config.load(this);
        
        // trigger the URL
        $(window).trigger("hashchange"); 

        // record that we have loaded so other stuff (QUnit) can check
        this.hasLoaded = true;
    }

    public recievers = {};

    constructor() {
        let that = this;
        
        // register the serviceWorker
        (function () {
            if (!navigator["serviceWorker"]) {
                console.log('Service workers are not supported.');
                return;
            }
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('./serviceworker.js', { scope: './' }).then((registration) => {
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

            // this will check the version and edit the data stores etc, if need be
            app.verifyDatabase();

            app.routing = new Routing(config.routes);
            
            // convert all a/href to a#href
            $("body").delegate("a", "click", function () {
                var href = $(this).attr("href"); // modify the selector here to change the scope of intercpetion

                // check its not an external / absolute URL
                let regex: RegExp = new RegExp(":\/\/", "ig");
                if (regex.exec(href))
                    document.location.href = href;
                else
                    document.location.hash = app.routing.logState(href);// Push this URL "state" onto the history hash.
                return false;
            });
            
            // Bind a callback that executes when document.location.hash changes.
            // unless we are tinkering with it...
            $(window).bind("hashchange", function (evt) {
                if (app.navigateOnHashChange) {
                    let state = app.routing.changeState(0);
                    app.routing.navigate(state);
                }
                return;
            });


            // wait untill we have loaded
            app.loaded();
        });
    }

    private verifyDatabase(): void {
        (function () {
            'use strict';

            //check for support
            if (!('indexedDB' in window)) {
                console.log('This browser doesn\'t support IndexedDB');
                return;
            }

            var dbPromise = idb.open(config.database.name, config.database.version, (upgradeDb) => {
                
                // delete them all on version change
                console.log("upgrading", upgradeDb);
                while (upgradeDb.objectStoreNames.length > 0) {
                    // always delete [0] as the array gets one shorter...
                    upgradeDb.deleteObjectStore(upgradeDb.objectStoreNames[0]);
                }
                
                for (let member in config.database.stores) {
                    let store = upgradeDb.createObjectStore(member, config.database.stores[member].key);
                    for (let i in config.database.stores[member].indexes) {
                        let index = config.database.stores[member].indexes[i];
                        store.createIndex(index.name, index.keyPath, index.options);
                    }
                }
                
            });
        })();
    }
}


