/// <reference path="../../Application/component.ts" />

class ClientError extends Component{
    // default template for when there isn't a better one
    $template: JQuery = $(`
    <app-component>
    <h1>Error</h1>
    <div>{{ code }} - {{ text }}</div>
    <a href=''>Go Home</a>
    <app-component />
    `);

    constructor() {
        super([
            { url: "Components/error/4xx.html", name: "4xx" },
            { url: "Components/error/401.html", name: "401" },
            { url: "Components/error/403.html", name: "403" },
            { url: "Components/error/404.html", name: "404" }
        ]);
    }

    draw(args: any): Promise<JQuery> {

        this.setTitle("Error");

        // look for a template
        if (!this.hasTemplate(args.code)) {
            let $template = this.getTemplate("4xx", args);
            return new Promise(resolve => { resolve($template) });
        }
        else {
            if (args.code == 401)
                this.setTitle("Login");

            return new Promise(resolve => {
                let $template = this.getTemplate(args.code);
                resolve($template);
            });
        }
    }

    login() {

        let user = this.$view.find("#401-user").val();
        let password = this.$view.find("#401-password").val();

        config.api.auth({
            EmailAddress: user,
            Password: password,
            PhoneNumber: null
        }).then(() => {
            // reload the current url - unless, its an error page - then load the home page
            if (document.location.hash.indexOf("#error/") === 0)
                app.routing.navigate('');
            else {
                let state = app.routing.changeState(0);
                app.routing.navigate(state);
            }
        }).catch(() => {
            app.routing.navigate('');
        });
    }
}