// Dependencies
var Bind = require("github/jillix/bind");
var Events = require("github/jillix/events");

/**
 * parseQuery
 * This function parses the query from url
 *
 * @name parseQuery
 * @function
 * @return {Object} An object with param names and values from location search
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
    var self = this;
    var config = processConfig(conf);
    var query = parseQuery();

    // call events
    Events.call(self, config);

    // emit ready
    self.emit("ready", config);

    // this is the provider callback
    if (query.provider) {
        handleProviderCallback(query);
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
            $(config.ui.login, self.dom).hide();
            $(config.ui.logout, self.dom).show();

            // add the logout handler
            $(self.dom).on("click", config.ui.logoutLink, function() {

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
        $(self.dom).on('click', config.ui.loginButton, function() {

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
        $(config.ui.logout).hide();
        $(config.ui.login).show();

        /**
         * verify
         * The page requires auth => redirects the
         * user automatically on the login link
         *
         * @name verify
         * @function
         * @return
         */
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
     * handleProviderCallback
     * This will be called when the login provider calls back on us.
     *
     * @name handleProviderCallback
     * @function
     * @param {Object} query The query object
     * @return
     */
    function handleProviderCallback(query) {

        // hide login
        $(config.ui.login, self.dom).hide();

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
     * logout
     * Logout operation
     *
     * @name logout
     * @function
     * @param {Function} callback The callback function
     * @return
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

    /**
     * processConfig
     * Sets defaults, and correct empty objects
     *
     * @name processConfig
     * @function
     * @param {Object} config Module config
     * @return {Object} Processed module configuration
     */
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
        config.ui = config.ui || {};
        config.ui.loginButton = config.ui.loginButton || ".login-button";
        config.ui.login = config.ui.login || ".login";
        config.ui.logout = config.ui.logout || ".logout";
        config.ui.logoutLink = config.ui.logoutLink || ".logout-btn";
        config.ui.userName = config.ui.userName || ".userName";

        // Auth
        config.auth = config.auth || {};
        config.auth.login = config.auth.login || {};
        config.auth.logout = config.auth.logout || {};
        config.auth.pages = config.auth.pages || [];

        return config;
    }

    /**
     * getCode
     * Gets callback code
     *
     * @name getCode
     * @function
     * @param {String} url The url value
     * @param {String} str String value that will be searched in url
     * @return {String} Temporal code value
     */
    function getCode(url, str) {
        return url.substring(url.indexOf(str) + str.length);
    }

    /**
     * requiresAuth
     * Verify if the user is on a page that require authentification
     *
     * @name requiresAuth
     * @function
     * @return {Boolean} Returns true if the page requires auth.
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
     * setUserInfoFrom
     * Set user info from "cookies" or from an object
     *
     * @name setUserInfoFrom
     * @function
     * @param {Object} input User data
     * @return
     */
    function setUserInfoFrom(input) {

        // each data-key element
        $(self.dom).find('[data-key]').each(function() {

            // get its key and value
            var key = $(this).attr('data-key');
            var value = input[key];

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
