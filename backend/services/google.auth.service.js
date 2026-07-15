/**
 * =====================================================
 * GOOGLE AUTH CONFIG
 * =====================================================
 * Store GOOGLE_CLIENT_ID in Script Properties.
 * Example:
 *   PropertiesService.getScriptProperties()
 *     .setProperty("GOOGLE_CLIENT_ID", "xxxxx.apps.googleusercontent.com");
 * =====================================================
 */
const GOOGLE_AUTH_CONFIG = {
  CLIENT_ID:
    PropertiesService
      .getScriptProperties()
      .getProperty("GOOGLE_CLIENT_ID") || ""
};


/**
 * =====================================================
 * GOOGLE AUTH SERVICE
 * =====================================================
 * FLOW
 * 1. Frontend sends Google ID token
 * 2. verifyGoogleIdToken()
 * 3. resolveGoogleLoginUser()
 * 4. loginResolver(workspaceSlug, email)
 * 5. touchAuthUserLastLogin()
 * 6. optional auto time-in hook
 * =====================================================
 */


/**
 * =====================================================
 * PUBLIC LOGIN ENTRYPOINT
 * =====================================================
 * payload = {
 *   id_token: string,
 *   workspace_slug?: string,
 *   auto_time_in?: boolean
 * }
 */
function loginWithGoogle(payload = {}) {
  const idToken = String(payload.id_token || "").trim();
  const workspaceSlug = String(payload.workspace_slug || "").trim();
  const autoTimeIn = payload.auto_time_in === true;

  console.log("[GoogleAuth] loginWithGoogle called", {
    hasIdToken: !!idToken,
    workspaceSlug,
    autoTimeIn,
  });

  if (!idToken) {
    throw new Error("Google ID token is required");
  }

  // =====================================================
  // 1. VERIFY GOOGLE TOKEN
  // =====================================================
  const googleProfile = verifyGoogleIdToken(idToken);

  console.log("[GoogleAuth] verified Google profile", {
    sub: googleProfile.sub,
    email: googleProfile.email,
    email_verified: googleProfile.email_verified,
  });

  // =====================================================
  // 2. RESOLVE INTERNAL AUTH USER
  // - by google_sub first
  // - fallback by email then link
  // =====================================================
  const authUser = resolveGoogleLoginUser(googleProfile);

  console.log("[GoogleAuth] resolved auth user", {
    user_id: authUser?.user_id,
    email: authUser?.email,
    auth_provider: authUser?.auth_provider,
    workspace_id: authUser?.workspace_id,
  });

  if (!authUser) {
    throw new Error("Unable to resolve Google login user");
  }

  const authStatus = normalize("status", authUser.status || "");

  if (authStatus !== "ACTIVE") {
    throw new Error("Auth user is not active");
  }

  // =====================================================
  // 3. REUSE EXISTING LOGIN RESOLVER
  // IMPORTANT:
  // - workspaceSlug is optional
  // - if not provided, resolver will resolve by email
  // =====================================================
  const login = loginResolver(
    workspaceSlug || "",
    googleProfile.email
  );

  console.log("[GoogleAuth] resolved workspace login", {
    success: login?.success,
    workspace_id: login?.workspace_id,
    user_id: login?.user_id,
    auth_user_id: login?.auth_user_id,
    role: login?.role,
  });

  if (!login || login.success !== true) {
    throw new Error("Login resolver failed");
  }

  // =====================================================
  // SECURITY CHECK
  // Ensure workspace login belongs to the authenticated
  // master auth user.
  // =====================================================
  if (
    login.auth_user_id &&
    login.auth_user_id !== authUser.user_id
  ) {
    throw new Error(
      "Workspace login does not belong to the authenticated user"
    );
  }

  // =====================================================
  // 4. TOUCH LAST LOGIN
  // =====================================================
  touchAuthUserLastLogin(authUser.user_id);

  // =====================================================
  // 5. OPTIONAL AUTO TIME-IN HOOK
  // =====================================================
  let autoTimeInResult = null;

  if (autoTimeIn) {
    autoTimeInResult = maybeAutoTimeInAfterGoogleLogin({
      authUser,
      googleProfile,
      login
    });

    console.log("[GoogleAuth] auto time-in result", autoTimeInResult);
  }

  // =====================================================
  // 6. NORMALIZED RESPONSE
  // =====================================================
  return {
    success: true,
    auth_method: AUTH_PROVIDERS.GOOGLE,

    auth_user: {
      user_id: authUser.user_id,
      email: authUser.email,
      fullname: authUser.fullname,
      role: authUser.role,
      workspace_id: authUser.workspace_id,
      auth_provider: authUser.auth_provider || AUTH_PROVIDERS.GOOGLE,
      google_email: authUser.google_email || googleProfile.email
    },

    google_profile: {
      sub: googleProfile.sub,
      email: googleProfile.email,
      name: googleProfile.name || "",
      given_name: googleProfile.given_name || "",
      family_name: googleProfile.family_name || "",
      picture: googleProfile.picture || ""
    },

    login,

    auto_time_in: autoTimeInResult
  };
}


/**
 * =====================================================
 * VERIFY GOOGLE ID TOKEN
 * =====================================================
 * Uses Google's tokeninfo endpoint.
 *
 * Returns normalized profile:
 * {
 *   sub,
 *   email,
 *   email_verified,
 *   name,
 *   given_name,
 *   family_name,
 *   picture
 * }
 * =====================================================
 */
function verifyGoogleIdToken(idToken) {
  const token = String(idToken || "").trim();

  if (!token) {
    throw new Error("Google ID token is required");
  }

  const clientId = String(GOOGLE_AUTH_CONFIG.CLIENT_ID || "").trim();

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const url =
    "https://oauth2.googleapis.com/tokeninfo?id_token=" +
    encodeURIComponent(token);

  let response;
  let statusCode;
  let body;

  try {
    response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true
    });

    statusCode = response.getResponseCode();
    body = response.getContentText();

  } catch (err) {
    throw new Error("Failed to verify Google token");
  }

  if (statusCode !== 200) {
    throw new Error("Invalid Google ID token");
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (err) {
    throw new Error("Failed to parse Google token response");
  }

  const aud = String(data.aud || "").trim();
  const iss = String(data.iss || "").trim();
  const exp = Number(data.exp || 0);
  const sub = String(data.sub || "").trim();
  const email = normalize("email", data.email || "");
  const emailVerified =
    String(data.email_verified || "").toLowerCase() === "true";

  if (!sub) {
    throw new Error("Google token missing subject");
  }

  if (!email) {
    throw new Error("Google token missing email");
  }

  if (!emailVerified) {
    throw new Error("Google account email is not verified");
  }

  if (aud !== clientId) {
    throw new Error("Google token audience mismatch");
  }

  if (
    iss !== "accounts.google.com" &&
    iss !== "https://accounts.google.com"
  ) {
    throw new Error("Google token issuer mismatch");
  }

  if (!exp || exp * 1000 < Date.now()) {
    throw new Error("Google ID token has expired");
  }

  return {
    sub,
    email,
    email_verified: true,
    name: data.name || "",
    given_name: data.given_name || "",
    family_name: data.family_name || "",
    picture: data.picture || ""
  };
}


/**
 * =====================================================
 * RESOLVE GOOGLE LOGIN USER
 * =====================================================
 * STRATEGY
 * 1. Match auth user by google_sub
 * 2. Else match auth user by email
 * 3. If email match found -> link google account
 * 4. Return final auth user
 * =====================================================
 */
function resolveGoogleLoginUser(googleProfile = {}) {
  const googleSub = String(googleProfile.sub || "").trim();
  const googleEmail = normalize("email", googleProfile.email || "");

  if (!googleSub) {
    throw new Error("googleProfile.sub is required");
  }

  if (!googleEmail) {
    throw new Error("googleProfile.email is required");
  }

  // =====================================================
  // 1. PRIMARY MATCH BY GOOGLE SUB
  // =====================================================
  let authUser = findAuthUserByGoogleSub(googleSub);

  if (authUser) {
    return authUser;
  }

  // =====================================================
  // 2. FALLBACK MATCH BY EMAIL
  // =====================================================
  authUser = findAuthUserByEmail(googleEmail);

  if (!authUser) {
    throw new Error("Google account is not authorized for this system");
  }

  // =====================================================
  // 3. LINK GOOGLE ACCOUNT TO AUTH USER
  // =====================================================
  linkGoogleAccountToAuthUser(authUser.user_id, googleProfile);

  // =====================================================
  // 4. RELOAD LATEST AUTH USER
  // =====================================================
  authUser = findAuthUserById(authUser.user_id);

  if (!authUser) {
    throw new Error("Failed to reload linked auth user");
  }

  return authUser;
}


/**
 * =====================================================
 * AUTO TIME-IN HOOK AFTER GOOGLE LOGIN
 * =====================================================
 * SAFE PLACEHOLDER.
 * This should call your actual attendance time-in service later.
 *
 * Expected future integration:
 * - prevent duplicate time-in
 * - only auto time-in for allowed roles
 * - use source = "GOOGLE_LOGIN_AUTO"
 * =====================================================
 */
function maybeAutoTimeInAfterGoogleLogin(context = {}) {
  try {
    const authUser = context.authUser || {};
    const googleProfile = context.googleProfile || {};
    const login = context.login || {};

    if (!login.workspace_id) {
      return {
        success: false,
        skipped: true,
        reason: "Missing workspace_id"
      };
    }

    if (!login.user_id) {
      return {
        success: false,
        skipped: true,
        reason: "Missing user_id"
      };
    }

    // =====================================================
    // TODO:
    // Replace this with your actual attendance auto-time-in call.
    //
    // Example target shape:
    //
    // const result = timeInResolver({
    //   workspace_id: login.workspace_id,
    //   user_id: login.user_id,
    //   source: "GOOGLE_LOGIN_AUTO",
    //   remarks: "Auto time-in after Google login"
    // });
    //
    // return result;
    // =====================================================

    return {
      success: true,
      skipped: true,
      reason: "Auto time-in hook not wired yet",
      source: "GOOGLE_LOGIN_AUTO",
      user_id: authUser.user_id || login.user_id,
      email: googleProfile.email || authUser.email || login.email || ""
    };

  } catch (err) {
    return {
      success: false,
      skipped: true,
      error: err.message || String(err)
    };
  }
}

function getCurrentUserEmail(){

  return Session
    .getActiveUser()
    .getEmail();

}

function loginWithGoogleEmail(email){

  const normalized =
    normalize("email", email);

  const login =
    loginResolver(
      "",
      normalized
    );

  return {
    success:true,
    login
  };
}
