const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  assert: require.resolve('assert'),
  buffer: require.resolve('buffer'),
  events: require.resolve('events'),
  process: require.resolve('process/browser'),
  stream: require.resolve('stream-browserify'),
  util: require.resolve('util'),
};

module.exports = config;
