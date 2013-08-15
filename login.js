var Bind = require("github/jillix/bind");
var Events = require("github/jillix/events");

var self;
var config;

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

module.exports = function (conf) {

    self = this;
    config = processConfig(conf);
    var query = parseQuery();

    Events.call(self, config);
    self.emit("ready", config);

    // this is the provider callback
    if (query.provider) {
        handleProviderCallback(query);
        return;
    }

    // show early the user info if this is available in the cookies
    //setUserInfoFrom("cookies");

    self.link("userInfo", function(err, data) {

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

        $(self.dom).on('click', config.classes.loginButton, function() {

            self.link('redirect', { data: { provider: $(this).attr('data-provider') } }, function(err, data) {
                if (err) {
                    console.log(err);
                    return;
                }
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
}

/*
 * This will be called when the login provider calls back on us.
 */
function handleProviderCallback(query) {
    $(config.classes.login, self.dom).hide();

    query.cookies = config.cookies;

    // call login operation
    self.link("login", { data: query }, function(err, data) {
        if (err) {
            console.log(err);
            return;
        }

        window.location = config.successPage;
    });
}

// Logout
function logout(callback) {

    for (var cookie in config.cookies) {
        $.removeCookie(cookie);
    }

    self.link("logout", callback);
    self.emit("loggedOut");
}

    /*
        config:

        {
            loginPage:     ..., (default: "/bitbucket-login")
            successPage:   ..., (default: "/")
            redirect_uri:  ...,
            logoutLink:    ..., (default: "/logout")
            htmlAttributes: {
                cookies: {
                    "userInfo": "data-user-cookie-info"
                }
            }
            classes: {
                loginButton: ..., (default: ".login-button")
                login:     ..., (default: ".login")
                logout:    ..., (default: ".logout")
                logoutLink:..., (default: ".logout-btn")
                notLogged: ..., (default: ".fail")
                username:  ... (default: ".userName")
            },
            auth: {
                login: {
                    redirect: ..., (default: true)
                },
                logout: {
                    redirect: ..., (default: false)
                },
                pages: [
                    "/examplePathName#withHash?andSomethingSearch"
                ]
            }
        }
    */

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
    config.classes = config.classes || {};
    config.classes.loginButton = config.classes.loginButton || ".login-button";
    config.classes.login = config.classes.login || ".login";
    config.classes.logout = config.classes.logout || ".logout";
    config.classes.logoutLink = config.classes.logoutLink || ".logout-btn";
    config.classes.userName = config.classes.userName || ".userName";

    // Auth
    config.auth = config.auth || {};
    config.auth.login = config.auth.login || {};
    config.auth.logout = config.auth.logout || {};
    config.auth.pages = config.auth.pages || [];

    return config;
}

// Gets callback code
function getCode(url, str) {
    return url.substring(url.indexOf(str) + str.length);
}

// Verify if the user is on a page that require authentification
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

// Set user info from "cookies" or from an object
function setUserInfoFrom(input) {

    $(self.dom).find('[data-key]').each(function() {
        $(this).html(input[$(this).attr('data-key')]);
    });

return;

    for (var key in config.cookies) {
        // TODO Dinamic HTML attributes?

        // Get attributes
        var attributesValues = [];

        var userInfoAttr = config.htmlAttributes.cookies.userInfo;


        if (attributesValues.indexOf(key) !== -1) {

            var userInfoValue;

            // TODO Get cookies as object
            if (input === "cookies") {
                userInfoValue = $.cookie(key);
            }
            else
            if (typeof input === "object") {
                userInfoValue =  input[config.cookies[key]];
            }

            if (userInfoValue) {
                loggedPrev = true;
                $("*[" + userInfoAttr + "=" + key + "]", self.dom).text(userInfoValue);
            }
        }
    }

    // Show the logout class if the user was
    // looged in previously (this means that there
    // is at least a cookie that is saved)
    if (loggedPrev) {
        $(config.classes.login).hide();
        $(config.classes.logout).show();
    }
    else {
        $(config.classes.logout).hide();
        $(config.classes.login).show();
    }
}
