/**
 *  Finds a user by providing datasource, userdata and a callback function
 *
 */
function findUser (ds, userData, callback) {

    // try to find first this user if he already used this provider
    getByProviderId(ds, userData.id, function(err, user) {

        // handle error
        if (err) { return callback(err); }

        // user found
        if (user) { return callback(null, user); }

        // now try to find a user having the sae provider email
        getByProviderEmail(ds, userData.email, function(err, user) {

            // handle error
            if (err) { return callback(err); }

            // user found
            callback(null, user);
        });
    });
}

/**
 *  Logs in a user
 *  If the user is not registered, he will be automatically registered
 *
 */
exports.login = function (link, userData, callback) {

    // get datasource
    M.datasource.resolve(link.params.ds, function(err, ds) {

        // handle error
        if (err) { return callback(err); }

        // find the user with matching this provider data
        findUser(ds, userData, function(err, user) {

            // handle error
            if (err) { return callback(err); }

            // the user already has an account
            if (user) {

                // this will update only the info for the requested provider
                update(ds, user, userData, function(err, user) {

                    // handle error
                    if (err) { return callback(err); }

                    // callback
                    callback(null, user._id.toString(), "*", prepareForSession(user));
                });

                return;
            }

            // it's a new user that has to be registered
            register(ds, userData, function(err, user) {

                // handle error
                if (err) { return callback(err); }

                // callback
                callback(null, user._id.toString(), "*", prepareForSession(user));
            });
        });
    });
};

/**
 *  Returns an object containing the session data for the logged in user
 *
 */
function prepareForSession (user) {

    // find the current provider
    var providerLogin;

    // search in user logins
    for (var i in user.logins) {
        if (user.logins[i].provider === user.last_login.provider) {
            providerLogin = user.logins[i];
            break;
        }
    }

    // just in case
    providerLogin.auth = providerLogin.auth || {};

    // build session data object
    var sessionData = {
        // the last_login has just been updated to the current provider
        provider: providerLogin.provider,
        login: providerLogin.username,
        email: providerLogin.email,
        fullname: providerLogin.fullname,
        auth: providerLogin.auth
    };

    return sessionData;
}

/**
 *  Get user by the provider-specific id
 *
 */
function getByProviderId (ds, id, callback) {

    // no id
    if (!id) { return callback('Missing user provider id'); }

    // get database
    M.database.open(ds, function(err, db) {

        // handle error
        if (err) { return callback(err); }

        // get collection
        db.collection(ds.collection, function(err, collection) {

            // handle error
            if (err) { return callback(err); }

            // find the provider
            collection.findOne({ "logins.id": id }, callback);
        });
    });
}

/**
 *  Get user by the provider-specific email
 *
 */
function getByProviderEmail (ds, email, callback) {

    // no email
    if (!email) { return callback('Missing user provider email'); }

    // get database
    M.database.open(ds, function(err, db) {

        // handle error
        if (err) { return callback(err); }

        // get collection
        db.collection(ds.collection, function(err, collection) {

            // handle error
            if (err) { return callback(err); }

            // find provider by email
            collection.findOne({ "logins.email": email }, callback);
        });
    });
}

/**
 *  Update user data for a provider
 *
 */
function update (ds, user, newProviderData, callback) {

    // no data
    if (!user || !newProviderData) { return callback('Invalid user or provider data during login update'); }

    // open database
    M.database.open(ds, function(err, db) {

        // handle error
        if (err) { return callback(err); }

        // open collection
        db.collection(ds.collection, function(err, collection) {

            // handle error
            if (err) { return callback(err); }

            // if the user already has this login, update it
            var hasProvider = false;;
            for (var i in user.logins) {
                // a provider login should never be null or undefined
                if (user.logins[i].provider === newProviderData.provider) {
                    user.logins[i] = newProviderData;
                    hasProvider = true;
                    break;
                }
            }

            // the first time logging in with this provider
            if (!hasProvider) {
                user.logins.push(newProviderData);
            }

            // last login
            var lastLogin = {
                    date: new Date().getTime()
                  , provider: newProviderData.provider
                }
              , updates = {
                    $set: {
                        last_login: lastLogin
                      , logins: user.logins
                    }
                }
              ;

            // update the user data
            collection.findAndModify({ _id: user._id }, [], updates, { new: true }, function(err, user) {

                // handle error
                if (err) { return callback(err); }

                // callback user
                callback(null, user);
            });
        });
    });
}

/*
 * Register a new user
 * Provide a default data to insert and datasource as parameters
 */
function register (ds, providerData, callback) {

    // missing data
    if (!providerData) { return callback("Missing provider data during registration"); }

    // open database
    M.database.open(ds, function(err, db) {

        // handle error
        if (err) { return callback(err); }

        // open collection
        db.collection(ds.collection, function(err, collection) {

            // handle error
            if (err) { return callback(err); }

            // build a new user
            var user = {
                email: providerData.email
              , last_login: {
                    date: new Date().getTime()
                  , provider: providerData.provider
                }
              , projects: []
              , logins: [providerData]
            };

            // insert the new user
            collection.insert(user, function(err, docs) {

                // handle error
                if (err) { return callback(err); }

                // no docs
                if (!docs[0]) { return callback('Registration failed'); }

                // success
                callback(null, docs[0]);
            });
        });
    });
}
