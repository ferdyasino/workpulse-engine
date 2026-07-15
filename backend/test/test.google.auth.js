function testGoogleClientId() {
  Logger.log(
    PropertiesService
      .getScriptProperties()
      .getProperty("GOOGLE_CLIENT_ID")
  );
}