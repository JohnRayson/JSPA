/// <reference path="../../Application/component.ts" />
class Component2 extends Component {

    // dataStore (or any name you like) can be used to store data relevent to the component
    private dataStore: any = [];
    
    // within the constructor we load the html templates
    constructor() {
        super([
            // load the html template
            { url: "Components/component-2/component-2.html", name: "master" },
        ]);
    }

    public draw(args: any): Promise<JQuery> {

        // create some fake entries
        this.dataStore = [];
        for (let t = 0; t < 5; t++) {
            this.dataStore.push({ name: "Tab " + (t + 1), data: "Content " + (t + 1) });
        }

        return new Promise(resolve => {
            let $page = this.getTemplate("master");
            $page.find(".nav-tabs").find(".nav-link").first().trigger("click");
            resolve($page);
        });
    }
}