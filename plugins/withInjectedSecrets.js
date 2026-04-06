const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withInjectedSecrets = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const googleServicesIos = process.env.GOOGLE_SERVICES_IOS;
      if (googleServicesIos) {
        const filePath = path.join(config.modRequest.projectRoot, 'GoogleService-Info.plist');
        fs.writeFileSync(filePath, googleServicesIos);
        console.log(`[Plugin] Injected GoogleService-Info.plist: ${filePath}`);
      }
      return config;
    },
  ], [
    'android',
    async (config) => {
      const googleServicesAndroid = process.env.GOOGLE_SERVICES_ANDROID;
      if (googleServicesAndroid) {
        const filePath = path.join(config.modRequest.projectRoot, 'google-services.json');
        fs.writeFileSync(filePath, googleServicesAndroid);
        console.log(`[Plugin] Injected google-services.json: ${filePath}`);
      }
      return config;
    },
  ]);
};

module.exports = withInjectedSecrets;
