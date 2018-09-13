/// <reference path="../../Application/component.ts" />

class AppHeader extends Component {

    constructor() {
        super({ url: "Components/app-header/app-header.html", name: "navigation" });
    }

    public draw(args: any): Promise<JQuery> {
        
        //this.$template = $("<div id='app-navigation' />").load("Components/app-navigation/app-navigation.html");
        let $template: JQuery = this.getTemplate("navigation");
        return new Promise(resolve => {
            resolve($template);
        });
    };
    
    public updatePrimaryNav(links: any[]): void {

        if (!links)
            links = [];
        
        // add the "Home" link
        links.unshift({ url: "#", text: "Home" });

        let $el = this.$view.find("ul.navbar-nav.mr-auto");
        $el.empty();
        for (let l = 0; l < links.length; l++) {
            // single links
            if (!$.isArray(links[l].url)) {
                $el.append($("<li />").addClass("nav-item" + (document.location.hash.replace("#", "") == links[l].url.replace("#", "") ? " active" : ""))
                    .append($("<a />").addClass("nav-link")
                        .attr("href", links[l].url)
                        .text(links[l].text)
                    )
                );
            }
            // drop down of links
            else {
                let $li = $("<li />").addClass("nav-item dropdown")
                    .append($("<li />").addClass("nav-link dropdown-toggle ") //btn btn-outline-secondary
                        .attr("role", "button")
                        .attr("data-toggle", "dropdown") // done through the attr() rather than data() to ensure its written out to the DOM, just in case
                        .text(links[l].text))
                    .append($("<div />").addClass("dropdown-menu")
                )
                for (let dd = 0; dd < links[l].url.length; dd++) {
                    $li.find("div")
                        .append($("<a />").addClass("dropdown-item")
                            .attr("href", links[l].url[dd].href)
                            .text(links[l].url[dd].text)
                        )
                }

                $el.append($li);
            }
        }
    }

    private keydown(src: JSPAEvent): void {
        if (src.evt.which === 13)
            this.search(src);
    }

    private search(src: JSPAEvent): void {
        let pattern = this.$view.find("#header-search").val();
        document.location.href = "#site-info/search/" + pattern;
    }

    private componentExtra(src: JSPAEvent): void {
        // this is based on the current component... so read the URL
        let url = document.location.href.split("#")[1];
        let component = url.split("/")[0];
        // what we do now is based on the component
        switch (component) {
            case "site-info":
                let siteId = config.utils.toNumber(url.split("/")[1]);
                if (siteId)
                    document.location.href = "#site-admin/" + siteId;
        }
    }

    private toggleSubscriptions(src: JSPAEvent): void {
        if (src.value == "pause") {
            config.api.pauseSubscriptions();
            toastr.warning("All subscriptions paused", "Paused data subscriptions")
        }
        else {
            config.api.resumeSubscriptions();
            toastr.success("All subscriptions resumed", "Resumed data subscriptions")
        }
    }
}