function testGoogleAuthConfig() {
  const result = {
    client_id_present: !!GOOGLE_AUTH_CONFIG.CLIENT_ID,
    client_id_preview: GOOGLE_AUTH_CONFIG.CLIENT_ID
      ? GOOGLE_AUTH_CONFIG.CLIENT_ID.slice(0, 25) + "..."
      : ""
  };

  Logger.log(JSON.stringify(result, null, 2));
  console.log(result);

  return result;
}