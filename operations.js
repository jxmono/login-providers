/**
 *  This function kills the session
 *
 */
function killSession(link, statusCode, err) {
    M.session.end(link, function () {
        link.send(statusCode, err);
    });
}

// virtual user id used for a fake session
const VIRTUAL_UID = -1;

/**
 *  Logout operation
 *
 */
exports.logout = function (link) {

    // get the session
    M.session.get(link, function (link) {

        // not logged in
        if (!link.session._uid) {
            link.send(400, 'You are not logged in');
            return;
        }

        // end session
        link.session.end(true, function () {
            link.send(200);
        });
    });
};

/**
 *  User info operation
 *
 */
exports.userInfo = function (link) {
    link.send(200, link.session.provider ? link.session : undefined);
};

/**
 *  This operation sends a redirect url that will be used on the
 *  client side
 *
 */
exports.redirect = function (link) {

    // no secrets
    if (!link.params.secretsFile) {
        link.send(400, "Missing secretsFile key");
        return;
    }

    // no data
    if (!link.data) {
        link.send(400, "Missing data");
        return;
    }

    // no provider
    if (!link.data.provider) {
        link.send(400, "Missing login provider");
        return;
    }

    try {
        //  find the provider and its secrets
        var secrets = require(M.app.getPath() + '/' + link.params.secretsFile)[link.data.provider];
        var provider = require('./providers/' + link.data.provider + '.js');
    } catch (e) {
        link.send(500, 'Missing or invalid data for provider: ' + link.data.provider);
        return;
    }

    // no secrets for this provider
    if (!secrets) {
        return callback('Missing secrets for provider: ' + link.params.provider);
    }

    // because of OAuth 1.0 that requires to save a server secret between requests
    // we have to start a session that will be renewed later
    M.session.start(link, link.session._rid, VIRTUAL_UID, link.session._loc, function (err) {

        // handle error
        if (err) { return killSession(link, 500, 'Could not start session'); }

        // compute the redirect link
        provider.redirectLink(link, secrets, function (err, url) {

            // handle erorr
            if (err) { return killSession(link, 500, err); }

            // success
            link.send(200, url);
        });
    });
};

/**
 *  Login operation
 *
 */
exports.login = function (link) {

    // Verify if the user is already logged in.
    if (link.session._uid && link.session._uid !== VIRTUAL_UID) {
        link.send(200, "You are already logged in");
        return;
    }

    // no data
    if (!link.data) {
        link.send(400, "Missing data");
        return;
    }

    // no provider
    if (!link.data.provider) {
        link.send(400, "Missing login provider");
        return;
    }

    // no datasource
    if (!link.params || !link.params.ds) {
        link.send(400, "Missing ds operation parameter");
        return;
    }

    // no custom file
    if (!link.params.custom) {
        link.send(400, "Please define a path to the login custom file");
        return;
    } else {
        try {
            // get the custom code
            var custom = require (M.app.getPath() + link.params.custom);
        } catch (e) {
            return link.send(400, "Invalid file path or syntax");
        }
    }

    // get cookies and logged user role
    var cookies = link.data.cookies
      , loggedUserRole = link.params.role
      ;

    try {
        //  find the provider and its secrets
        var secrets = require(M.app.getPath() + '/' + link.params.secretsFile)[link.data.provider];
        var provider = require('./providers/' + link.data.provider + '.js');
    } catch (e) {
        link.send(500, 'Missing or invalid data for provider: ' + link.data.provider);
        return;
    }

    // no secrets
    if (!secrets) {
        return callback('Missing secrets for provider: ' + link.params.provider);
    }

    // get the user data from this provider
    provider.getUserData(link, secrets, function (err, providerUserData) {

        // handle error
        if (err) {
            return killSession(link, 500, 'Error while retrieving user data for provider: ' + link.data.provider);
        }

        // add the provider to the user data
        providerUserData.provider = link.data.provider;

        // login
        custom.login(link, providerUserData, function (err, userId, locale, data) {

            // handle error
            if (err) {
                return killSession(link, 500, 'Custom login code error');
            }

            // make sure the user data does not come with an _id because this will break the session
            if (data._id) {
                delete data._id;
            }

            // Getting the role
            M.app.getRole(M.config.app.id, loggedUserRole, function (err, role) {

                // handle error
                if (err) {
                    return killSession(link, 500, 'Role not found: ' + loggedUserRole);
                }

                // Start session
                M.session.renew(link, role.id, userId, locale, data, function (err) {

                    // handle error
                    if (err) {
                        return killSession(link, 500, 'Could not start session');
                    }

                    // success
                    link.send(200);
                });
            });
        });
    });
};
