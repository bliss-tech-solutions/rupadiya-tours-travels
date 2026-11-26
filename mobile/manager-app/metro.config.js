// Expo's default Metro config. It registers font assets (.ttf) used by @expo/vector-icons,
// so the dev server (expo start) resolves them the same way `expo export` does.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
