// bind and events dependencies
var Bind = require("github/jillix/bind")
  , Events = require("github/jillix/events")
  ;

/**
 *  This function parses the query from url
 *
 */
function parseQuery() {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    var result = {};
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        result[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
    return result;
}

/**
 *  Login Providers
 *  Mono login modules using external providers like Github, Bitbucket, etc
 *
 */
module.exports = function (conf) {

    // get self, config and query
    var self = this
      , config = processConfig (conf)
      , query = parseQuery ()
      ;

    // call events
    Events.call(self, config);

    // emit ready
    self.emit("ready", config);

    // this is the provider callback
    if (query.provider) {
        handleProviderCallback (query);
        return;
    }

    // show early the user info if this is available in the cookies
    //setUserInfoFrom("cookies");

    // get the userinfo
    self.link("userInfo", function(err, data) {

        // handle error
        if (err) {
            alert(err);
            return;
        }

        /* =====================
         * The user is logged in
         * ===================== */
        if (data) {

            // let others know the user is logged in
            self.emit('userInfo', data);

            // and also we have to adjust the cookies/UI
            setUserInfoFrom(data);

            // show the logged in mode
            $(config.classes.login, self.dom).hide();
            $(config.classes.logout, self.dom).show();

            // add the logout handler
            $(self.dom).on("click", config.classes.logoutLink, function() {

                // call logout operation
                logout(function() {
                    window.location = config.successPage;
                });
                return false;
            });

            return;
        }

        /* =========================
         * The user is NOT logged in
         * ========================= */

        // delete the cookies (if any)
        for (var cookie in config.cookies) {
            $.removeCookie(cookie);
        }

        // login handlers
        $(self.dom).on('click', config.classes.loginButton, function() {

            // change the cursor
            $("body").css("cursor", "wait");

            // send the provider
            self.link('redirect', { data: { provider: $(this).attr('data-provider') } }, function(err, data) {

                // handle error
                if (err) {
                    console.error (err);
                    return;
                }

                // success, redirect
                window.location = data;
            });
            return false;
        });

        // show the correct UI parts
        $(config.classes.logout).hide();
        $(config.classes.login).show();

        // The page requires auth => redirects the
        // user automatically on the login link
        // TODO A better way?
        function verify() {
            var redirect = config.auth.login.redirect
            if (requiresAuth() && redirect) {
                if (typeof redirect === "object") {
                    self.emit("redirect", redirect.page);
                    return;
                }
                window.location = redirect;
            }
        }

        verify();

        $(window).on("hashchange", function() {
            verify();
        });
    });

    /**
     * This will be called when the login provider calls back on us.
     *
     */
    function handleProviderCallback(query) {

        // hide login
        $(config.classes.login, self.dom).hide();

        // get cookies
        query.cookies = config.cookies;

        // call login operation
        self.link("login", { data: query }, function(err, data) {

            // handle error
            if (err) {
                console.error(err);
                return;
            }

            // redirect
            window.location = config.successPage;
        });
    }

    /**
     *  Logout operation
     *
     */
    function logout(callback) {

        // remove cookies
        for (var cookie in config.cookies) {
            $.removeCookie(cookie);
        }

        // call logout operation
        self.link("logout", callback);

        // emit logged out
        self.emit("loggedOut");
    }

    // Sets defaults, and correct empty objects
    function processConfig(config) {

        // General
        config.successPage = config.successPage || "/";
        config.logoutLink = config.logoutLink || "/logout";

        // Html Attributes
        // TODO Dinamic HTML Attributes, like for cookies?
        config.htmlAttributes = config.htmlAttributes || {};
        config.htmlAttributes.cookies = config.htmlAttributes.cookies || {};
        config.htmlAttributes.cookies.userInfo = config.htmlAttributes.cookies.userInfo || "data-user-cookie-info";

        // Classes
        config.ui = config.classes || {};
        config.ui.loginButton = config.classes.loginButton || ".login-button";
        config.ui.login = config.classes.login || ".login";
        config.ui.logout = config.classes.logout || ".logout";
        config.ui.logoutLink = config.classes.logoutLink || ".logout-btn";
        config.ui.userName = config.classes.userName || ".userName";

        // Auth
        config.auth = config.auth || {};
        config.auth.login = config.auth.login || {};
        config.auth.logout = config.auth.logout || {};
        config.auth.pages = config.auth.pages || [];

        return config;
    }

    /**
     *  Gets callback code
     *
     */
    function getCode(url, str) {
        return url.substring(url.indexOf(str) + str.length);
    }

    /**
     * Verify if the user is on a page that require authentification
     *
     */
    function requiresAuth() {

        var location = window.location;
        var currentPage = location.pathname + location.hash + location.search;

        // Return true if the page is on the list
        if (config.auth.pages.indexOf(currentPage) !== -1) {
            return true;
        }

        // default: false
        return false;
    }

    /**
     * Set user info from "cookies" or from an object
     *
     */
    function setUserInfoFrom(input) {

        // each data-key element
        $(self.dom).find('[data-key]').each(function() {

            // get its key and value
            var key = $(this).attr('data-key')
              , value = input[key]
              ;

            // "*" is special
            if (key === "*") {
                value = input;
            }

            // value is an object that must be stringified
            if (typeof value === "object") {
                value = JSON.stringify(value, null, 4);
            }

            // set the html for this element
            $(this).html(value);
        });
    }
}
