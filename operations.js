
var VIRTUAL_UID = -1;


exports.logout = function(link) {

    M.session.get(link, function(link) {

        if (!link.session._uid) {
            link.send(400, 'You are not logged in');
            return;
        }

        link.session.end(true, function() {
            link.send(200);
        });
    });
};

exports.userInfo = function(link) {
    link.send(200, link.session.provider ? link.session : undefined);
};

function killSession(link, statusCode, err) {
    M.session.end(link, function() {
        link.send(statusCode, err);
    })
}

exports.redirect = function (link) {

    if (!link.params.secretsFile) {
        link.send(400, "Missing secretsFile key");
        return;
    }

    if (!link.data) {
        link.send(400, "Missing data");
        return;
    }

    if (!link.data.provider) {
        link.send(400, "Missing login provider");
        return;
    }

    //  find the provider and its secrets
    var secrets;
    var provider;

    try {
        secrets = require(M.app.getPath() + '/' + link.params.secretsFile)[link.data.provider];
        provider = require('./providers/' + link.data.provider + '.js');
    } catch (e) {
        link.send(500, 'Missing or invalid data for provider: ' + link.data.provider);
        return;
    }

    if (!secrets) {
        return callback('Missing secrets for provider: ' + link.params.provider);
    }

    // because of OAuth 1.0 that requires to save a server secret between requests
    // we have to start a session that will be renewed later
    M.session.start(link, link.session._rid, VIRTUAL_UID, link.session._loc, function(err) {

        if (err) { return killSession(link, 500, 'Could not start session'); }
        provider.redirectLink(link, secrets, function(err, url) {

            if (err) {
                return killSession(link, 500, err);
            }

            // TODO
            //link.res.headers["location"] = url;
            //link.send(308, "page redirected");

            link.send(200, url);
        });
    });
};

exports.login = function(link) {

    // Verify if the user is already logged in.
    if (link.session._uid && link.session._uid !== VIRTUAL_UID) {
        link.send(200, "You are already logged in");
        return;
    }

    if (!link.data) {
        link.send(400, "Missing data");
        return;
    }

    if (!link.data.provider) {
        link.send(400, "Missing login provider");
        return;
    }

    if (!link.params || !link.params.ds) {
        link.send(400, "Missing ds operation parameter");
        return;
    }

    var cookies = link.data.cookies;
    var loggedUserRole = link.params.role;

    //  find the provider and its secrets
    var secrets;
    var provider;

    try {
        secrets = require(M.app.getPath() + '/' + link.params.secretsFile)[link.data.provider];
        provider = require('./providers/' + link.data.provider + '.js');
    } catch (e) {
        link.send(500, 'Missing or invalid data for provider: ' + link.data.provider);
        return;
    }

    if (!secrets) {
        return callback('Missing secrets for provider: ' + link.params.provider);
    }

    // get the user data from this provider
    provider.getUserData(link, secrets, function(err, providerUserData) {

        if (err) {
            return killSession(link, 500, 'Error while retrieving user data for provider: ' + link.data.provider);
        }

        // add the provider to the user data
        providerUserData.provider = link.data.provider;

        var custom = require('./custom.js');
        custom.login(link, providerUserData, function(err, userId, locale, data) {

            if (err) {
                return killSession(link, 500, 'Custom login code error');
            }

            // make sure the user data does not come with an _id because this will break the session
            if (data._id) {
                delete data._id;
            }

            // Getting the role
            M.app.getRole(M.config.app.id, loggedUserRole, function(err, role) {

                if (err) {
                    return killSession(link, 500, 'Role not found: ' + loggedUserRole);
                }

                // Start session
                M.session.renew(link, role.id, userId, locale, data, function(err) {

                    if (err) {
                        return killSession(link, 500, 'Could not start session');
                    }

                    link.send(200);
                });
            });
        });
    });
};

