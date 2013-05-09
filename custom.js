
function findUser (ds, userData, callback) {

    // try to find first this user if he already used this provider
    getByProviderId(ds, userData.id, function(err, user) {

        if (err) { return callback(err); }

        if (user) { return callback(null, user); }

        // now try to find a user having the sae provider email
        getByProviderEmail(ds, userData.email, function(err, user) {

            if (err) { return callback(err); }

            callback(null, user);
        });
    });
}

exports.login = function (link, userData, callback) {

    M.datasource.resolve(link.params.ds, function(err, ds) {

        if (err) { return callback(err); }

        // find the user with matching this provider data
        findUser(ds, userData, function(err, user) {

            if (err) { return callback(err); }

            // the user already has an account
            if (user) {

                // this will update only the info for the requested provider
                update(ds, user, userData, function(err, user) {

                    if (err) { return callback(err); }

                    callback(null, user._id.toString(), "*", prepareForSession(user));
                });

                return;
            }

            // it's a new user that has to be registered
            register(ds, userData, function(err, user) {

                if (err) { return callback(err); }

                callback(null, user._id.toString(), "*", prepareForSession(user));
            });
        });
    });
};

function prepareForSession (user) {

    // find the current provider
    var providerLogin;
    for (var i in user.logins) {
        if (user.logins[i].provider === user.last_login.provider) {
            providerLogin = user.logins[i];
            break;
        }
    }

    var sessionData = {
        // the last_login has just been updated to the current provider
        provider: providerLogin.provider,
        email: providerLogin.email,
        fullname: providerLogin.fullname
    };

    return sessionData;
}

/*
 * Get user by the provider-specific id
 */
function getByProviderId (ds, id, callback) {

    if (!id) { return callback('Missing user provider id'); }

    M.database.open(ds, function(err, db) {

        if (err) { return callback(err); }

        db.collection(ds.collection, function(err, collection) {

            if (err) { return callback(err); }

            collection.findOne({ "logins.id": id }, callback);
        });
    }); 
}

/*
 * Get user by the provider-specific email
 */
function getByProviderEmail (ds, email, callback) {

    if (!email) { return callback('Missing user provider email'); }

    M.database.open(ds, function(err, db) {

        if (err) { return callback(err); }

        db.collection(ds.collection, function(err, collection) {

            if (err) { return callback(err); }

            collection.findOne({ "logins.email": email }, callback);
        });
    }); 
}

/*
 * Update user data for a provider
 */
function update (ds, user, newProviderData, callback) {

    if (!user || !newProviderData) { return callback('Invalid user or provider data during login update'); }

    M.database.open(ds, function(err, db) {

        if (err) { return callback(err); }

        db.collection(ds.collection, function(err, collection) {

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

            var lastLogin = {
                date: new Date().getTime(),
                provider: newProviderData.provider
            };

            var updates = {
                $set: {
                    last_login: lastLogin,
                    logins: user.logins
                }
            };

            collection.findAndModify({ _id: user._id }, [], updates, { new: true }, function(err, user) {

                if (err) { return callback(err); }

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

    if (!providerData) { return callback("Missing provider data during registration"); }

    M.database.open(ds, function(err, db) {

        if (err) { return callback(err); }

        db.collection(ds.collection, function(err, collection) {

            if (err) { return callback(err); }

            // build a new user
            var user = {
                email: providerData.email,
                last_login: {
                    date: new Date().getTime(),
                    provider: providerData.provider
                },
                projects: [],
                logins: [ providerData ]
            };

            collection.insert(user, function(err, docs) {

                if (err) { return callback(err); }

                if (!docs[0]) { return callback('Registration failed'); }

                callback(null, docs[0]);
            });
        });
    }); 
}

