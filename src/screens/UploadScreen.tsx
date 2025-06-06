import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, Image } from 'react-native';
import { launchImageLibrary, MediaType } from 'react-native-image-picker';

const UploadScreen = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const selectVideo = () => {
    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: 300, // 5 minutes max
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled video selection');
      } else if (response.errorMessage) {
        console.log('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Error', 'Failed to select video');
      } else if (response.assets && response.assets[0]) {
        const video = response.assets[0];
        setSelectedVideo(video);
        console.log('Selected video:', video);
      }
    });
  };

  const uploadVideo = async () => {
    if (!selectedVideo) {
      Alert.alert('No Video', 'Please select a video first');
      return;
    }

    try {
      // Here you would upload to Firebase Storage
      console.log('Uploading video:', selectedVideo.uri);
      Alert.alert('Success', 'Video uploaded successfully!');
      
      // TODO: Add Firebase upload logic
      // TODO: Add ball tracking processing
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload video');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Video</Text>
      <Text style={styles.subtitle}>
        Select a volleyball game video for ball tracking analysis
      </Text>

      {selectedVideo && (
        <View style={styles.videoInfo}>
          <Text style={styles.videoText}>Selected: {selectedVideo.fileName}</Text>
          <Text style={styles.videoText}>
            Duration: {Math.round(selectedVideo.duration / 1000)}s
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button title="Select Video" onPress={selectVideo} />
        
        {selectedVideo && (
          <Button 
            title="Upload & Analyze" 
            onPress={uploadVideo}
            color="#007AFF"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  videoInfo: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  videoText: {
    fontSize: 14,
    marginBottom: 5,
  },
  buttonContainer: {
    gap: 15,
  },
});

export default UploadScreen;