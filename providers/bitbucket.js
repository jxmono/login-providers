// dependencies and globals
var BitBucket = require("./bitbucket_api").BitBucket
  , OAuth = require("oauth").OAuth
  , request = require('request')
  , bitbucket = new BitBucket(true)

  , OAUTH
  , SECRET_KEY
  , CLIENT_ID
  , LOGIN_LINK
  ;


/**
 *  This inits the global constants
 *
 */
function setupOauth(secrets) {

    // set the secret key, client id and login link
    SECRET_KEY = secrets.secretKey;
    CLIENT_ID = secrets.clientId;
    LOGIN_LINK = secrets.loginLink;

    // create a new instance of oauth object
    OAUTH = new OAuth(
        "https://bitbucket.org/api/1.0/oauth/request_token/"
      , "https://bitbucket.org/api/1.0/oauth/access_token/"
      , CLIENT_ID
      , SECRET_KEY
      , "1.0"
      , LOGIN_LINK
      , "HMAC-SHA1"
    );
}

/**
 *  This function computes the redirection link by providing
 *  the link object, the secrets object and the callback
 *  function
 *
 */
exports.redirectLink = function (link, secrets, callback) {

    // validate secrets
    if (!secrets.clientId || !secrets.secretKey || !secrets.loginLink) {
        return callback('The ' + link.data.provider + ' secrets must contain: clientId, secretKey, loginLink');
    }

    // initialize Oauth if necessary
    if (!OAUTH) {
        setupOauth(secrets);
    }

    // obtain an oauth token secret
    OAUTH.getOAuthRequestToken(function(err, oauthToken, oauthTokenSecret, results) {

        // handle error
        if (err) { return callback(err); }

        // save these in the session for later request
        var data = {
            oauthToken: oauthToken
          , oauthTokenSecret: oauthTokenSecret
        };

        // set session data
        link.session.set(data);

        // create the redirect link
        var url = OAUTH.signUrl("https://bitbucket.org/api/1.0/oauth/authenticate/", oauthToken, oauthTokenSecret, "GET");

        // and callback it
        callback(null, url);
    });
};

/**
 *  This function gets the user data by providing
 *  the link object, the secrets object and the callback
 *  function
 *
 */
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
        link.session.oauthToken
      , link.session.oauthTokenSecret
      , link.data.oauth_verifier
    , function(err, oauth_access_token, oauth_access_token_secret, results) {

        // handle error
        if (err) { return callback(err); }

        // authenticate API
        bitbucket.authenticateOAuth(OAUTH, oauth_access_token, oauth_access_token_secret);

        // get the user profile using bitbucket api
        bitbucket.getUserApi().getUserProfile(function(err, profile) {

            // handle error
            if (err) { return callback(err); }

            // get the user data using bitbucket api
            bitbucket.getEmailApi().getAll(function (err, emails) {

                // handle error
                if (err) { return callback(err); }

                // the user must have at least one active primary email address
                var email;
                for (var i in emails) {
                    if (emails[i].active && emails[i].primary) {
                        email = emails[i].email;
                        break;
                    }
                }

                // no email
                if (!email) {
                    return callback('This Bitbucket user is not active');
                }

                // User information
                var userData = {
                    // TODO watch this issue:
                    // https://bitbucket.org/site/master/issue/7321/add-a-stable-id-to-the-user-endpoint-when
                    id: 'bitbucket_' + profile.user.username
                  ,  username: profile.user.username
                  ,  fullname: profile.user.display_name
                  ,  email: email
                  ,  raw: profile
                  ,  auth: {
                        access_token: oauth_access_token
                      , access_token_secret: oauth_access_token_secret
                    }
                    // other provider specific data
                  , emails: emails
                };

                // callback user data
                callback(null, userData);
            });
        });
    });
};
