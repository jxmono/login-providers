// dependencies and globals
var request = require("request")
  , Github = require('github')
  , gh = new Github({ version: '3.0.0' })

  , SECRET_KEY
  , CLIENT_ID
  , REDIRECT_URI
  ;


/**
 *  This sets the global variables
 *
 */
function setupGlobals(secrets) {
    SECRET_KEY = secrets.secretKey;
    CLIENT_ID = secrets.clientId;
    REDIRECT_URI = secrets.redirectUri;
}

/**
 *  This function computes the redirection link by providing
 *  the link object, the secrets object and the callback
 *  function
 *
 */
exports.redirectLink = function (link, secrets, callback) {

    // validate secrets
    if (!secrets || !secrets.clientId || !secrets.secretKey) {
        return callback('The github secrets must contain: clientId, secretKey');
    }

    // initialize globals if necessary
    if (!SECRET_KEY || !CLIENT_ID) {
        setupGlobals(secrets);
    }

    // try to get the scopes from secrets object
    var scopes = secrets.scopes || [
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

    // create the redirection url
    var url = "https://github.com/login/oauth/authorize?client_id=" + CLIENT_ID +
              (REDIRECT_URI ? "&redirect_uri=" + REDIRECT_URI : "") +
              "&scope=" + scopes.join();

    // and callback it
    callback(null, url);
};

/**
 *  This function gets the user data by providing
 *  the link object, the secrets object and the callback
 *  function
 *
 */
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

        // handle error
        if (err) { return callback(err); }

        // authneticate the request
        gh.authenticate({ type: 'oauth', token: accessToken });

        // get github user data
        gh.user.get({}, function(err, profile) {

            // handle error
            if (err) { return callback(err); }

            // get user emails
            gh.user.getEmails({}, function(err, emails) {

                // handle error
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
                    emails: emails,
                    auth: {
                        access_token: accessToken
                    }
                };

                // callback user data
                callback(null, userData);
            });
        });
    });
};

/**
 *  Get access token
 *  This function will return access token IF the temp code is correct
 *  or if there appears an error will send the error.
 *
 */
function getAccessToken(code, callback) {

    // build the redirection url
    var url = "https://github.com/login/oauth/access_token?client_id=" + CLIENT_ID +
              (REDIRECT_URI ? "&redirect_uri=" + REDIRECT_URI : "") +
              "&client_secret=" + SECRET_KEY + "&code=" + code;

    // request options
    var options = {
        url: url,
        json: true
        //headers: { 'accept': 'application/json' }
    };

    // run the post request
    request.post(options, function (err, res, body) {

        // handle errors
        if (err || res.statusCode !== 200) {
            return callback(err || 'Github returned ' + res.statusCode);
        }

        if (body.error) {
            return callback(body.error);
        }

        // success
        callback(null, body.access_token);
    });
}
