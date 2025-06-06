import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

const RecordScreen = () => {
  const [isRecording, setIsRecording] = useState(false);
  const devices = useCameraDevices();
  const device = devices.back;

  const startRecording = async () => {
    try {
      // Request camera permission first
      const permission = await Camera.requestCameraPermission();
      if (permission === 'denied') {
        Alert.alert('Camera permission denied');
        return;
      }

      setIsRecording(!isRecording);
      
      if (!isRecording) {
        // Start recording logic here
        console.log('Starting recording...');
      } else {
        // Stop recording logic here
        console.log('Stopping recording...');
      }
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  if (!device) {
    return (
      <View style={styles.container}>
        <Text>Loading camera...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Camera
        device={device}
        isActive={true}
        style={StyleSheet.absoluteFill}
        video={true}
        audio={true}
      />
      <View style={styles.buttonContainer}>
        <Button 
          title={isRecording ? "Stop Recording" : "Start Recording"} 
          onPress={startRecording} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
});

export default RecordScreen;