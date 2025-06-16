// App.tsx
import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import 'react-native-gesture-handler'; // Must be at the top
import AppNavigator from './src/navigation/AppNavigator';
import VolleyballTracker from './src/VolleyballTracker';


function App(): React.JSX.Element {
  return (
    <>
      <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <AppNavigator />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});

export default App;