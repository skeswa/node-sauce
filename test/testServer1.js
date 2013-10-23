var fakeGoogleApi = new require("../lib/apis/oauth2api.js")("fakeGoogle", {}, {
    clientId: "1073639428455-4i31qgcbhon7dvstd9r6efeo7rhcsedl.apps.googleusercontent.com",
    clientSecret: "TdJQNp1INvQHdCINUiQbR6PZ",
    scopes: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gcm_for_chrome",
}, {
    authUrl: "https://accounts.google.com/o/oauth2/auth",
    tokenUrl: "https://accounts.google.com/o/oauth2/token",
    requestUrl: "https://www.googleapis.com/",
    requiresScopes: true,
    authTokenGrantType: "authorization_code",
    authResponseType: "code",
    authRequiresState: true,
    clientConfig: {
        authorizationHeaderPrefix: "OAuth"
    }
});