import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Dimensions,
  PermissionsAndroid,
} from 'react-native';
import { launchImageLibrary, MediaType } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Video from 'react-native-video'; // Add this dependency

const { width } = Dimensions.get('window');

interface VideoData {
  uri: string;
  fileName: string;
  fileSize: number;
  type: string;
  duration: number;
}

const UploadScreen = ({ navigation }) => {
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ballColors, setBallColors] = useState({ primary: 'yellow', secondary: 'blue' });
  const [gameType, setGameType] = useState('indoor'); // indoor/beach/practice

  // Request permissions for Android
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
        
        return (
          granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true;
  };

  const selectVideo = async () => {
    // Request permissions first
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant storage permissions to select videos');
      return;
    }

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: 600, // 10 minutes
      includeBase64: false,
      includeExtra: true,
      // Add these options for better Android compatibility
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled video selection');
      } else if (response.errorMessage) {
        console.log('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Error', 'Failed to select video: ' + response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        const video = response.assets[0];
        
        // Debug logging
        console.log('Video selection details:', {
          uri: video.uri,
          duration: video.duration,
          durationInSeconds: video.duration ? Math.floor(video.duration / 1000) : 0,
          fileSize: video.fileSize,
          fileName: video.fileName,
          type: video.type
        });

        // Validate video file
        if (video.fileSize && video.fileSize > 500 * 1024 * 1024) { // 500MB limit
          Alert.alert('File Too Large', 'Please select a video file smaller than 500MB');
          return;
        }

        // For duration, if it's 0 or undefined, we'll calculate it after upload
        const duration = video.duration || 0;

        setSelectedVideo({
          uri: video.uri!,
          fileName: video.fileName || `volleyball_${Date.now()}.mp4`,
          fileSize: video.fileSize || 0,
          type: video.type || 'video/mp4',
          duration: duration,
        });
        console.log('Selected video URI:', video.uri);
      }
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (milliseconds: number): string => {
    if (milliseconds === 0) return 'Unknown';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Fixed upload function with better error handling
  const uploadVideo = async () => {
    if (!selectedVideo || !videoTitle.trim()) {
      Alert.alert('Error', 'Please select a video and enter a title');
      return;
    }

    const currentUser = auth().currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to upload videos');
      return;
    }

    console.log('Starting upload process...');
    console.log('Selected video details:', selectedVideo);
    console.log('Current user:', currentUser.uid);

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create unique filename with user ID and timestamp
      const timestamp = Date.now();
      const sanitizedTitle = videoTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `videos/${currentUser.uid}/${timestamp}_${sanitizedTitle}.mp4`;
      
      console.log('Upload filename:', fileName);
      console.log('Original URI:', selectedVideo.uri);
      
      // Fix URI handling for different platforms
      let fileUri = selectedVideo.uri;
      
      if (Platform.OS === 'android') {
        // Handle Android URI format
        if (fileUri.startsWith('content://')) {
          // Content URI - use as is
          console.log('Using content URI:', fileUri);
        } else if (fileUri.startsWith('file://')) {
          // File URI - keep as is for putFile
          console.log('Using file URI:', fileUri);
        } else {
          // Add file:// prefix if missing
          fileUri = `file://${fileUri}`;
          console.log('Added file:// prefix:', fileUri);
        }
      }
      
      // Create Firebase Storage reference
      const reference = storage().ref(fileName);
      console.log('Firebase reference created:', fileName);
      
      // Upload the file
      console.log('Starting upload with URI:', fileUri);
      const uploadTask = reference.putFile(fileUri);

      // Monitor upload progress
      uploadTask.on('state_changed', (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(Math.round(progress));
        console.log(`Upload progress: ${progress}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`);
      });

      // Wait for upload to complete
      const uploadResult = await uploadTask;
      console.log('Upload completed:', uploadResult);

      // Get download URL
      const downloadURL = await reference.getDownloadURL();
      console.log('Download URL obtained:', downloadURL);

      // Save metadata to Firestore
      const videoDoc = await firestore().collection('videos').add({
        title: videoTitle.trim(),
        description: description.trim(),
        fileName: selectedVideo.fileName,
        fileSize: selectedVideo.fileSize,
        duration: selectedVideo.duration > 0 ? Math.round(selectedVideo.duration / 1000) : null,
        downloadURL,
        storagePath: fileName,
        uploadedBy: currentUser.uid,
        uploadedAt: firestore.FieldValue.serverTimestamp(),
        
        // Ball tracking configuration
        ballColors: {
          primary: ballColors.primary,
          secondary: ballColors.secondary,
        },
        gameType,
        
        // Processing status
        processed: false,
        status: 'pending',
        processingStartedAt: null,
        processingCompletedAt: null,
        outputVideoURL: null,
        
        // Analytics
        views: 0,
        shared: 0,
        
        // OpenCV processing metadata
        trackingData: {
          ballDetections: 0,
          confidenceScore: 0,
          processingTime: 0,
          framesProcessed: 0,
        },
      });

      console.log('Video document created with ID:', videoDoc.id);

      Alert.alert(
        'Upload Successful! 🏐',
        'Your volleyball video has been uploaded and queued for ball tracking analysis. You\'ll be notified when processing is complete.',
        [
          {
            text: 'View Processing Queue',
            onPress: () => {
              if (navigation) navigation.navigate('ProcessingQueue');
            },
          },
          {
            text: 'Upload Another',
            onPress: () => {
              // Reset form
              setSelectedVideo(null);
              setVideoTitle('');
              setDescription('');
              setBallColors({ primary: 'yellow', secondary: 'blue' });
              setGameType('indoor');
            },
          },
          {
            text: 'Go Home',
            onPress: () => {
              if (navigation) navigation.navigate('Home');
            },
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Upload error details:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'Failed to upload video. Please try again.';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'You don\'t have permission to upload videos. Please check your Firebase authentication.';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Upload was canceled.';
      } else if (error.code === 'storage/object-not-found') {
        errorMessage = 'Could not access the selected video file. Please try selecting the video again or check app permissions.';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'An unknown error occurred. Please check your internet connection and try again.';
      } else if (error.message && error.message.includes('ENOENT')) {
        errorMessage = 'The selected video file could not be found. Please select the video again.';
      } else if (error.message && error.message.includes('permission')) {
        errorMessage = 'Permission denied. Please check app permissions and try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeVideo = () => {
    Alert.alert(
      'Remove Video',
      'Are you sure you want to remove the selected video?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSelectedVideo(null);
            setUploadProgress(0);
          },
        },
      ]
    );
  };

  const BallColorSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ball Tracking Settings 🏐</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Primary Ball Color</Text>
        <View style={styles.colorButtons}>
          {['yellow', 'white', 'orange', 'green'].map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorButton,
                { backgroundColor: color },
                ballColors.primary === color && styles.colorButtonSelected,
              ]}
              onPress={() => setBallColors({ ...ballColors, primary: color })}
            >
              <Text style={[
                styles.colorButtonText,
                color === 'yellow' || color === 'white' ? { color: '#333' } : { color: '#FFF' }
              ]}>
                {color}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Secondary Ball Color (Optional)</Text>
        <View style={styles.colorButtons}>
          {['blue', 'red', 'black', 'none'].map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorButton,
                { backgroundColor: color === 'none' ? '#E5E5E5' : color },
                ballColors.secondary === color && styles.colorButtonSelected,
              ]}
              onPress={() => setBallColors({ ...ballColors, secondary: color })}
            >
              <Text style={[
                styles.colorButtonText,
                color === 'none' || color === 'white' ? { color: '#333' } : { color: '#FFF' }
              ]}>
                {color}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Game Type</Text>
        <View style={styles.gameTypeButtons}>
          {[
            { key: 'indoor', label: '🏟️ Indoor', desc: 'Standard court' },
            { key: 'beach', label: '🏖️ Beach', desc: 'Sand court' },
            { key: 'practice', label: '🏃 Practice', desc: 'Training session' },
          ].map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.gameTypeButton,
                gameType === type.key && styles.gameTypeButtonSelected,
              ]}
              onPress={() => setGameType(type.key)}
            >
              <Text style={styles.gameTypeButtonLabel}>{type.label}</Text>
              <Text style={styles.gameTypeButtonDesc}>{type.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Volleyball Video 🏐</Text>
        <Text style={styles.subtitle}>
          Upload your volleyball game for AI-powered ball tracking analysis
        </Text>
      </View>

      {/* Video Selection */}
      <View style={styles.section}>
        {!selectedVideo ? (
          <TouchableOpacity style={styles.selectButton} onPress={selectVideo}>
            <Text style={styles.selectButtonIcon}>📹</Text>
            <Text style={styles.selectButtonText}>Choose Video File</Text>
            <Text style={styles.selectButtonSubtext}>
              Select MP4, MOV, or AVI files (max 10 min, 500MB)
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.videoInfo}>
            <View style={styles.videoPreview}>
              <Text style={styles.videoPreviewText}>🎥 Video Selected</Text>
            </View>
            
            <View style={styles.videoDetails}>
              <Text style={styles.videoText}>📁 {selectedVideo.fileName}</Text>
              <Text style={styles.videoText}>
                ⏱️ Duration: {formatDuration(selectedVideo.duration)}
              </Text>
              <Text style={styles.videoText}>
                📏 Size: {formatFileSize(selectedVideo.fileSize)}
              </Text>
              <Text style={styles.videoText}>
                📍 URI: {selectedVideo.uri.substring(0, 50)}...
              </Text>
            </View>
            
            <TouchableOpacity onPress={removeVideo} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>❌ Remove Video</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Video Details Form */}
      {selectedVideo && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Video Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={videoTitle}
                onChangeText={setVideoTitle}
                placeholder="e.g., Championship Finals vs Eagles"
                placeholderTextColor="#999"
                maxLength={100}
              />
              <Text style={styles.characterCount}>{videoTitle.length}/100</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add notes about the game, key moments, or specific tracking requirements..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.characterCount}>{description.length}/500</Text>
            </View>
          </View>

          <BallColorSelector />
        </>
      )}

      {/* Upload Progress */}
      {uploading && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Uploading Video... {uploadProgress}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            Please don't close the app while uploading
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {selectedVideo && (
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!videoTitle.trim() || uploading) && styles.uploadButtonDisabled,
            ]}
            onPress={uploadVideo}
            disabled={!videoTitle.trim() || uploading}
          >
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.uploadButtonText}>Uploading...</Text>
              </View>
            ) : (
              <Text style={styles.uploadButtonText}>🚀 Upload & Start Analysis</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 Tip: For best results, ensure good lighting and clear ball visibility
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1D1D1F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 16,
  },
  selectButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
  },
  selectButtonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  selectButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  selectButtonSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  videoInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
  },
  videoPreview: {
    height: 120,
    backgroundColor: '#E5E5E5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  videoPreviewText: {
    fontSize: 16,
    color: '#666',
  },
  videoDetails: {
    marginBottom: 12,
  },
  videoText: {
    fontSize: 15,
    marginBottom: 6,
    color: '#333',
    fontWeight: '500',
  },
  removeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1D1D1F',
    backgroundColor: '#FFF',
  },
  textArea: {
    height: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  colorButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
    alignItems: 'center',
  },
  colorButtonSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  colorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  gameTypeButtons: {
    gap: 8,
  },
  gameTypeButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFF',
  },
  gameTypeButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  gameTypeButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  gameTypeButtonDesc: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    margin: 16,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  uploadButtonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default UploadScreen;