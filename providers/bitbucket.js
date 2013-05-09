var BitBucket = require("./bitbucket_api").BitBucket;
var OAuth = require("oauth").OAuth;
var request = require('request');

var bitbucket = new BitBucket(true);

// globals
var OAUTH;
var SECRET_KEY;
var CLIENT_ID;
var LOGIN_LINK;


function setupOauth(secrets) {

    SECRET_KEY = secrets.secretKey;
    CLIENT_ID = secrets.clientId;
    LOGIN_LINK = secrets.loginLink;

    OAUTH = new OAuth(
        "https://bitbucket.org/api/1.0/oauth/request_token/",
        "https://bitbucket.org/api/1.0/oauth/access_token/", 
        CLIENT_ID,
        SECRET_KEY,
        "1.0",
        LOGIN_LINK,
        "HMAC-SHA1"
    );
}

exports.redirectLink = function (link, secrets, callback) {

    // validate secrets
    if (!secrets.clientId || !secrets.secretKey || !secrets.loginLink) {
        return callback('The ' + link.data.provider + ' secrets must contain: clientId, secretKey, loginLink');
    }

    // initialize Oauth if necessary
    if (!OAUTH) {
        setupOauth(secrets);
    }

    OAUTH.getOAuthRequestToken(function(err, oauthToken, oauthTokenSecret, results) {

        if (err) { return callback(err); }

        // save these in the session for later request
        var data = {
            oauthToken: oauthToken,
            oauthTokenSecret: oauthTokenSecret 
        };
        link.session.set(data);

        var url = OAUTH.signUrl("https://bitbucket.org/api/1.0/oauth/authenticate/", oauthToken, oauthTokenSecret, "GET");

        callback(null, url);
    });
};

exports.getUserData = function (link, secrets, callback) {

    // validate secrets
    if (!secrets || !secrets.clientId || !secrets.secretKey || !secrets.loginLink) {
        return callback('The ' + link.data.provider + ' secrets must contain: clientId, secretKey, loginLink');
    }

    // validate the input data
    if (!link.data.oauth_verifier) {
        return callback('The ' + link.data.provider + ' auth data must contain: oauth_verifier');
    }

    // initialize Oauth if necessary
    if (!OAUTH) {
        setupOauth(secrets);
    }

    // suppose that the user gave access to the application from Bitbucket
    OAUTH.getOAuthAccessToken(
        link.session.oauthToken,
        link.session.oauthTokenSecret,
        link.data.oauth_verifier,
        function(err, oauth_access_token, oauth_access_token_secret, results) {

        if (err) { return callback(err); }

        // authenticate API
        bitbucket.authenticateOAuth(OAUTH, oauth_access_token, oauth_access_token_secret);

        bitbucket.getUserApi().getUserProfile(function(err, profile) {

            if (err) { return callback(err); }

            // authenticate API
            //bitbucket.authenticateOAuth(OAUTH, oauth_access_token, oauth_access_token_secret);

            bitbucket.getEmailApi().getAll(function (err, emails) {

                if (err) { return callback(err); }

                // the user must have at least one active primary email address
                var email;
                for (var i in emails) {
                    if (emails[i].active && emails[i].primary) {
                        email = emails[i].email;
                        break;
                    }
                }

                if (!email) {
                    return callback('This Bitbucket user is not active');
                }

                // User information
                var userData = {
                    // TODO watch this issue:
                    // https://bitbucket.org/site/master/issue/7321/add-a-stable-id-to-the-user-endpoint-when
                    id: 'bitbucket_' + profile.user.username,
                    username: profile.user.username,
                    fullname: profile.user.display_name,
                    email: email,
                    raw: profile,
                    // other provider specific data
                    auth: [
                        oauth_access_token,
                        oauth_access_token_secret
                    ],
                    emails: emails
                };

                callback(null, userData);
            });
        });
    });
};

