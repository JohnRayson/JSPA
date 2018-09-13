/// <reference path="component.ts" />

class JSPATests extends Component {

    constructor() {
        super("QUnit.html");
    }

    public draw(): Promise<JQuery> {
        
        return new Promise((resolve) => {
            let $page = this.getTemplate("content");
            resolve($page);
        });
    }

    protected drawn(): void {


        console.log("IN DRAWN(): ");

        let that = this;

        let wtf = null;
        function doTest() {
            console.log("testing QUnit");

            if (!window["QUnit"]) {
                window.setTimeout(() => { doTest(); }, 1);
                return;
            }
            that.runAllTests();
        }
        doTest();
    }

    
    private runAllTests(): void {
        
        QUnit.test("Test test", t => {
            t.equal(1 == 1, true, "Simple equal");
        });

        this.routingTests();
        
        //QUnit.test("Routing", t => {
        //    t.deepEqual(app.routing.routes[0].test("error/401"), { code: "401" }, "Route.test()");
        //    t.deepEqual(app.routing.routes[0].test("error/word"), { }, "Route.test()");
        //});
        QUnit.done(() => {
            console.log("Finished all tests");
            $("#application a").each(function(a) {
                // hack the link
                let href = $(this).attr("href");
                $(this).attr("href", href.replace("?", "#qunit/?"));
            });

            delete window["QUnit"];
        });
        

        QUnit.start();
        
    }

    private routingTests(): void {
        QUnit.test("Routing", t => {
            for (let r = 0; r < app.routing.routes.length; r++) {

                let expected = {};

                // what does this route say?
                let route: Route = app.routing.routes[r];
                let parts: string[] = route.path.split("/");

                let path = "";
                let value = null;

                for (let p = 0; p < parts.length; p++) {
                    // need to reset this so we don't carry it over
                    value = null;
                    // is it a variable
                    if (parts[p].indexOf("?") == 0) {
                        let pair = parts[p].split(":");

                        // wyhat type of variable are we looking at
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
    }
}