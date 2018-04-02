/// <reference path="../../Application/component.ts" />

class AppFooter extends Component {

    constructor() {
        super({ url: "Components/app-footer/app-footer.html", name: "footer" });
    }

    public draw(args: any): Promise<JQuery> {
        let $template: JQuery = this.getTemplate("footer");
        return new Promise(resolve => { resolve($template); });
    }
}