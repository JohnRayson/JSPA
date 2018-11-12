/// <reference path="../../Application/component.ts" />

class Home extends Component {

    dataStore: any = null;

    constructor() {
        super([
            { url: "Components/home/home.html", name: "home" },
            ]);
    }
    
    render(): JQuery {
        if (typeof (this.dataStore) != "undefined") {
            let $page = this.getTemplate("home");
            
            return $page;
        }
        return this.waitOnData();
    }


    draw(args: any): Promise<JQuery> {

        this.setTitle("JSPA");
        
        return new Promise((resolve) => {
            // call the API, or grab something from the local store etc
            this.dataStore = [];
            resolve(this.render());
        });
    };
}