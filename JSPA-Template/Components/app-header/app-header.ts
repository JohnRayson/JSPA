/// <reference path="../../Application/component.ts" />

class AppHeader extends Component {

    constructor() {
        super({ url: "Components/app-header/app-header.html", name: "navigation" });
    }

    draw(args: any): Promise<JQuery> {
        
        //this.$template = $("<div id='app-navigation' />").load("Components/app-navigation/app-navigation.html");
        let $template: JQuery = this.getTemplate("navigation");
        return new Promise(resolve => {
            resolve($template);
        });
    };

    search(): void {
        let pattern = this.$view.find("#header-search").val();
        document.location.href = "#search/" + pattern;
    }
}