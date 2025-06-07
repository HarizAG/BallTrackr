// App.tsx
import React from 'react';
import { StatusBar } from 'react-native';
import 'react-native-gesture-handler'; // Must be at the top
import AppNavigator from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AppNavigator />
    </>
  );
}

export default App;