# Login providers
Mono login modules using external providers like Github, Bitbucket etc.

## Config

```js
{
    // general
    successPage:   ...      // (default: "/")
  , logoutLink:    ...      // (default: "/logout")

    // this will be passed to the redirection link; not required
  , redirect_uri:  ...

    // HTML attributes
  , htmlAttributes: {
        cookies: {
            "userInfo": ... // (default: "data-user-cookie-info")
        }
    }

    // jquery selectors for the login controls
  , ui: {
        loginButton: ...    // (default: ".login-button")
      , login:       ...    // (default: ".login")
      , logout:      ...    // (default: ".logout")
      , logoutLink:  ...    // (default: ".logout-btn")
      , notLogged:   ...    // (default: ".fail")
      , username:    ...    // (default: ".userName")
    }

    // auth data
  , auth: {
        login: {
            redirect: ...   // (default: empty object)
        },
        logout: {
            redirect: ...   // (default: empty object)
        },
        pages: [
            "/examplePathName#withHash?andSomethingSearch" // (default: empty array)
        ]
    }
}
```

## Example

```json
{
    ...
  , "login": {
        "module": "github/jillix/login-providers/MODULE_VERSION"
      , "roles": MONO_ROLES
      , "config": CONFIG_OBJECT
      , "operations": {
            "redirect": {
                "roles": MONO_ROLES
              , "params": [
                    { "secretsFile": "/path/to/secrets.json" }
                  , ...
                ]
            }
          , "login": {
                "roles": MONO_ROLES
              , "params": [
                    {
                        "secretsFile": "/path/to/secrets.json"
                        "custom": "/path/to/login_custom.js"
                      , "ds": "accountDS"
                      , "role": "MONO_ROLE_NAME"
                    }
                  , ...
                ]
            }
          , "logout": {
                "roles": MONO_ROLES
              , "params": []
            }
          , "userInfo": {
                "roles": MONO_ROLES
              , "params": []
            }
        }
    }
  , ...
}
```

## Secrets.json

```json
{
    "github": {
        "clientId": "your app client id"
      , "secretKey": "your secret key"
      , "scopes": ["scope", "another scope"]
    }
  , "anotherProvider": {
        "clientId": "your app client id"
      , "secretKey": "your secret key"
      , "scopes": ["scope", "another scope"]
    }
}
```

# Changelog

### v0.2.2
 - Updated Bind and Events

### v0.2.1
 - Removed `custom.js` from module
 - Fixed a bug generated after replacing `classes` with `ui`.

### v0.2.0
 - Added Events and Bind dependencies
 - Emit `ready`
 - Emit `redirect` and redirect page as parameter
 - Cursor wait when click on Login button
 - Fixed redirect problem
 - Strigify info value if it is an object
 - `*` for showing the entire account object
 - Custom scopes defined in secrets
 - Some syntax changes and comments
 - Replaced `classes` object name with `ui`.

### v0.1.0
 - Initial release
