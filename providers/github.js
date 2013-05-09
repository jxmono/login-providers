var request = require("request");

var Github = require('github');
var gh = new Github({ version: '3.0.0' });

// globals
var SECRET_KEY;
var CLIENT_ID;
var REDIRECT_URI;


function setupGlobals(secrets) {
    SECRET_KEY = secrets.secretKey;
    CLIENT_ID = secrets.clientId;
    REDIRECT_URI = secrets.redirectUri;
}

exports.redirectLink = function (link, secrets, callback) {

    // validate secrets
    if (!secrets || !secrets.clientId || !secrets.secretKey) {
        return callback('The github secrets must contain: clientId, secretKey');
    }

    // initialize globals if necessary
    if (!SECRET_KEY || !CLIENT_ID) {
        setupGlobals(secrets);
    }

    var scopes = [
        "repo",
        "user",
        "user:email",
        "user:follow",
        "public_repo",
        "repo:status",
        "delete_repo",
        "notifications",
        "gist"
    ];

    var url =
        "https://github.com/login/oauth/authorize?client_id=" + CLIENT_ID +
        (REDIRECT_URI ? "&redirect_uri=" + REDIRECT_URI : "") +
        "&scope=" + scopes.join();

    callback(null, url);
};

exports.getUserData = function (link, secrets, callback) {

    // validate secrets
    if (!secrets || !secrets.clientId || !secrets.secretKey) {
        return callback('The ' + link.data.provider + ' secrets must contain: clientId, secretKey');
    }

    // validate the input data
    if (!link.data.code) {
        return callback('The ' + link.data.provider + ' auth data must contain: code');
    }

    // initialize globals if necessary
    if (!SECRET_KEY || !CLIENT_ID) {
        setupGlobals(secrets);
    }

    // Get access token
    getAccessToken(link.data.code, function(err, accessToken) {

        if (err) { return callback(err); }

        // authneticate the request
        gh.authenticate({ type: 'oauth', token: accessToken });

        gh.user.get({}, function(err, profile) {

            if (err) { return callback(err); }

            gh.user.getEmails({}, function(err, emails) {

                if (err) { return callback(err); }

                // the user must have at least one active primary email address
                var email = emails[0];
                // TODO watch this pull request or wait until the emails come in the new format (similar to Bitbucket):
                // https://github.com/ajaxorg/node-github/pull/17
                if (!email) {
                    return callback('This Github user is not active');
                }

                // User information
                var userData = {
                    id: 'github_' + profile.id,
                    username: profile.login,
                    fullname: profile.name,
                    email: profile.email || email,
                    raw: profile,
                    emails: emails
                };

                callback(null, userData);
            });
        });
    });
};

/**
 * Get access token
 * This function will return access token IF the temp code is correct
 * or if there appears an error will send the error.
 */
function getAccessToken(code, callback) {
    var url = "https://github.com/login/oauth/access_token?client_id=" + 
        CLIENT_ID + (REDIRECT_URI ? "&redirect_uri=" + REDIRECT_URI : "") + 
        "&client_secret=" + SECRET_KEY + "&code=" + code;

    var options = {
        url: url,
        json: true
        //headers: { 'accept': 'application/json' }
    };

    request.post(options, function (err, res, body) {

        if (err || res.statusCode !== 200) {
            return callback(err || 'Github returned ' + res.statusCode);
        }

        if (body.error) {
            return callback(body.error);
        }

        callback(null, body.access_token);
    });
}

