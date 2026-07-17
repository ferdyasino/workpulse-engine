/**
 * =====================================================
 * AUTH USER REPOSITORY
 * MASTER AUTH USERS ONLY
 * =====================================================
 */

function getMasterUsers() {
  return find(getMasterDatabase(), AUTH_TABLES.USERS);
}

function findAuthUserById(userId) {
  if (!userId) return null;

  return findOne(getMasterDatabase(), AUTH_TABLES.USERS, {
    user_id: userId,
  });
}

function findAuthUserByEmail(email) {
  const normalizedEmail = normalize("email", email);

  if (!normalizedEmail) return null;

  return findOne(getMasterDatabase(), AUTH_TABLES.USERS, {
    email: normalizedEmail,
  });
}

function findAuthUserByGoogleSub(googleSub) {
  const sub = String(googleSub || "").trim();

  if (!sub) return null;

  return findOne(getMasterDatabase(), AUTH_TABLES.USERS, {
    google_sub: sub,
  });
}

/**
 * =====================================================
 * LINK GOOGLE ACCOUNT TO EXISTING AUTH USER
 * =====================================================
 * RULES
 * - if auth_provider is password -> becomes both
 * - if auth_provider is empty -> becomes google
 * - google_sub is authoritative once linked
 */
function linkGoogleAccountToAuthUser(userId, googleProfile = {}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const authUser = findAuthUserById(userId);

  if (!authUser) {
    throw new Error("Auth user not found");
  }

  const googleSub = String(googleProfile.sub || "").trim();
  const googleEmail = normalize("email", googleProfile.email || "");

  if (!googleSub) {
    throw new Error("googleProfile.sub is required");
  }

  if (!googleEmail) {
    throw new Error("googleProfile.email is required");
  }

  // =====================================================
  // ALREADY LINKED
  // =====================================================
  const currentGoogleSub = String(authUser.google_sub || "").trim();
  const currentGoogleEmail = normalize("email", authUser.google_email || "");

  if (currentGoogleSub === googleSub && currentGoogleEmail === googleEmail) {
    return {
      success: true,
      user_id: userId,
      auth_provider: authUser.auth_provider,
      google_sub: currentGoogleSub,
      google_email: currentGoogleEmail,
      already_linked: true,
    };
  }

  // =====================================================
  // PREVENT REPLACING EXISTING GOOGLE ACCOUNT
  // =====================================================
  if (currentGoogleSub && currentGoogleSub !== googleSub) {
    throw new Error("This account is already linked to a different Google account");
  }

  // =====================================================
  // SAFETY: prevent same google_sub being linked elsewhere
  // =====================================================
  const existingGoogleUser = findAuthUserByGoogleSub(googleSub);

  if (existingGoogleUser && existingGoogleUser.user_id !== userId) {
    throw new Error("This Google account is already linked to another user");
  }

  const currentProvider = String(authUser.auth_provider || "").toLowerCase();

  let nextProvider = AUTH_PROVIDERS.GOOGLE;

  if (currentProvider === AUTH_PROVIDERS.PASSWORD) {
    nextProvider = AUTH_PROVIDERS.BOTH;
  } else if (currentProvider === AUTH_PROVIDERS.BOTH) {
    nextProvider = AUTH_PROVIDERS.BOTH;
  } else if (currentProvider === AUTH_PROVIDERS.GOOGLE) {
    nextProvider = AUTH_PROVIDERS.GOOGLE;
  }

  const ok = update(getMasterDatabase(), AUTH_TABLES.USERS, userId, {
    auth_provider: nextProvider,
    google_sub: googleSub,
    google_email: googleEmail,
    updated_at: new Date().toISOString(),
  });

  if (!ok) {
    throw new Error("Failed to link Google account to auth user");
  }

  return {
    success: true,
    user_id: userId,
    auth_provider: nextProvider,
    google_sub: googleSub,
    google_email: googleEmail,
  };
}

/**
 * =====================================================
 * TOUCH LAST LOGIN
 * =====================================================
 */
function touchAuthUserLastLogin(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const ok = update(getMasterDatabase(), AUTH_TABLES.USERS, userId, {
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!ok) {
    throw new Error("Failed to update auth last login");
  }

  return {
    success: true,
    user_id: userId,
  };
}
