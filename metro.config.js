const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');

config.transformer.minifierConfig = {
  compress: false,
  mangle: false,
};

module.exports = config;
