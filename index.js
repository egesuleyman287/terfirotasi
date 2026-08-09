// Expo Go's iOS runtime expects the React Native FormData global during startup.
// Set it before the Expo modules used by the application are loaded.
const NativeFormData = require('react-native/Libraries/Network/FormData').default;
if (!global.FormData) {
  global.FormData = NativeFormData;
}

const registerRootComponent = require('expo/src/launch/registerRootComponent').default;
const App = require('./App').default;

registerRootComponent(App);
