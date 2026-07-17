function getGoogleClientId() {
  const clientId = PropertiesService.getScriptProperties().getProperty("GOOGLE_CLIENT_ID");

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  return clientId.trim();
}

function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error("Google credential is required");
  }

  const response = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
    {
      muteHttpExceptions: true,
    },
  );

  const payload = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(payload.error_description || payload.error || "Invalid Google token");
  }

  if (payload.aud !== getGoogleClientId()) {
    throw new Error("Invalid Google client");
  }

  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    throw new Error("Invalid token issuer");
  }

  if (payload.email_verified !== "true") {
    throw new Error("Email not verified");
  }

  return {
    provider: "google",
    google_id: payload.sub,
    email: payload.email,
    fullname: payload.name,
    picture: payload.picture || "",
    email_verified: true,
  };
}
