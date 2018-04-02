
/// <reference path="../../Application/component.ts" />
class Component1 extends Component {

    // dataStore (or any name you like) can be used to store data relevent to the component
    private dataStore: any = {
        code: null,
        template: null
    }

    // within the constructor we load the html templates
    constructor() {
        super([
            // load the html template
            { url: "Components/component-1/component-1.html", name: "master" },
        ]);
    }

    // the routing calls the draw() function when navigating between components
    // INPUT: an object that is constructed from the URL parameters
    // OUTPUT: a Promise() of a JQuery object
    public draw(args: any): Promise<JQuery> {
        return new Promise((resolve, reject) => {

            let calls = [];

            // load this code file into a string
            calls.push(
                fetch("Components/component-1/component-1.ts").then((response) => {
                    return response.text();
                }).then((body) => {
                    // store the response in our local data store
                    this.dataStore.code = body;
                })
            );
            // load this template file into a string
            calls.push(
                fetch("Components/component-1/component-1.html").then((response) => {
                    return response.text();
                }).then((body) => {
                    // store the response in our local data store
                    this.dataStore.template = body;
                })
            );

            // wait for both fetch()'s to resolve, then bind
            Promise.all(calls).then(() => {
                // replace the current view with the results of the render() function
                this.$view.replaceWith(this.render());
                // call highlight.js to prettify it
                this.$view.find("pre code").each(function (i, block) {
                    hljs.highlightBlock(block);
                });
            });
            
            // resolve immediatally to give feedback that we are waiting on data
            resolve(this.render());
        });
    }

    // internal function, this works out if we have the data we need yet, if not it will display "Waiting on data.."
    private render(): JQuery {
        // check to see if we have recieved a response from our load of the `code`
        if (this.dataStore.code && this.dataStore.template) {
            // create a JQuery object from the template named `master`
            // this will also bind the content of the <pre><code> block
            // this.getTemplate(name:string, object:any) will bind the data passed into it to the template identified by the `name`
            // if no second parameter is passed in then the whole Component is used as the source of the data
            let $page = this.getTemplate("master");
            return $page;
        }
        // we are still waiting on the fetch(), return a built in place holder
        return this.waitOnData();
    }
}