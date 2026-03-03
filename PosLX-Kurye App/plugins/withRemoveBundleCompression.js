const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withRemoveBundleCompression(config) {
    return withAppBuildGradle(config, async (config) => {
        config.modResults.contents = config.modResults.contents.replace(
            /^\s*enableBundleCompression\s*=.*/gm,
            '    // enableBundleCompression removed for RN 0.77 compatibility'
        );
        return config;
    });
};
