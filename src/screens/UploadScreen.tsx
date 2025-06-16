import React, { useState, useRef, useEffect } from 'react';
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
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVideoInfo } from 'react-native-video-info';
// Remove the runOnJS import since we'll handle it differently
// import { runOnJS } from 'react-native-reanimated';
// import OpenCV from 'react-native-opencv3';


const { width, height: screenHeight } = Dimensions.get('window');

interface VideoData {
  uri: string;
  fileName: string;
  fileSize: number;
  type: string;
  duration: number;
}

interface SavedVideo {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  duration: number;
  localPath: string;
  ballColors: {
    primary: string;
    secondary: string;
  };
  gameType: string;
  createdAt: string;
  processed: boolean;
  status: string;
  ballDetections: any[];
  trackingSettings: TrackingSettings;
}

interface TrackingSettings {
  hueMin: number;
  hueMax: number;
  satMin: number;
  satMax: number;
  valMin: number;
  valMax: number;
  minRadius: number;
  maxRadius: number;
}

const UploadScreen = ({ navigation }) => {
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [ballColors, setBallColors] = useState({ primary: 'yellow', secondary: 'blue' });
  const [gameType, setGameType] = useState('indoor');
  
  // Ball tracking states (simplified without reanimated)
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [ballDetected, setBallDetected] = useState(false);
  const [ballPosition, setBallPosition] = useState({ x: 0, y: 0 });
  const [trackingSettings, setTrackingSettings] = useState<TrackingSettings>({
    hueMin: 0,
    hueMax: 30,
    satMin: 100,
    satMax: 255,
    valMin: 100,
    valMax: 255,
    minRadius: 10,
    maxRadius: 100,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ballDetections, setBallDetections] = useState<any[]>([]);

  const trackingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (trackingRef.current) {
        clearInterval(trackingRef.current);
      }
    };
  }, []);

  // Ball tracking methods (simplified without reanimated)
  const processCameraFrame = (frame: any) => {
    if (!isTrackingEnabled) return;

    try {
    // TODO: Implement real OpenCV ball detection here
    // Process the camera frame and detect volleyball
    // Return detection results with x, y, radius, confidence
    } catch (error) {
      console.error('Frame processing error:', error);
    }
  };

      const startTracking = () => {
        console.log('Starting real ball tracking...');
        setBallDetections([]);
        // TODO: Initialize real camera/video processing
        // TODO: Set up OpenCV processing pipeline
      };


  const stopTracking = () => {
    if (trackingRef.current) {
      clearInterval(trackingRef.current);
      trackingRef.current = null;
    }
    setBallDetected(false);
    console.log('Ball tracking stopped. Total detections:', ballDetections.length);
  };

  const toggleTracking = () => {
    setIsTrackingEnabled(prev => !prev);
    if (!isTrackingEnabled && isProcessing) {
      startTracking();
    } else if (isTrackingEnabled) {
      stopTracking();
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ];
        
        if (Platform.Version >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO as any);
        } else {
          permissions.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        return (
          granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED ||
          granted['android.permission.READ_MEDIA_VIDEO'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true;
  };

  // Fixed getVideoDuration function
const getVideoDuration = async (uri: string): Promise<number> => {
  try {
    console.log('Getting video info for URI:', uri);
    const videoInfo = await getVideoInfo(uri);
    console.log('Video info result:', videoInfo);
    
    if (videoInfo && videoInfo.duration) {
      // The duration from react-native-video-info is already in seconds
      // Convert to milliseconds for consistency with your app
      const durationMs = Math.round(videoInfo.duration * 1000);
      console.log('Video duration (seconds):', videoInfo.duration);
      console.log('Video duration (ms):', durationMs);
      return durationMs;
    }
  } catch (error) {
    console.warn('Failed to get video duration with react-native-video-info:', error);
    
    // Fallback: Try to get duration using a different approach
    try {
      console.log('Trying fallback duration method...');
      return await getDurationFallback(uri);
    } catch (fallbackError) {
      console.warn('Fallback duration method also failed:', fallbackError);
    }
  }
  return 0;
};

// Fallback method using Video component (add this new function)
const getDurationFallback = (uri: string): Promise<number> => {
  return new Promise((resolve) => {
    // Create a temporary video element to load metadata
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration * 1000); // Convert to milliseconds
      console.log('Fallback duration found:', duration);
      resolve(duration);
    };
    
    video.onerror = () => {
      console.warn('Fallback method failed to load video metadata');
      resolve(0);
    };
    
    // Set a timeout to avoid hanging
    setTimeout(() => {
      console.warn('Fallback duration timeout');
      resolve(0);
    }, 5000);
    
    video.src = uri;
  });
};
  const selectVideo = async () => {
  const hasPermission = await requestStoragePermission();
  if (!hasPermission) {
    Alert.alert('Permission Required', 'Please grant storage permissions to select videos');
    return;
  }

  const options = {
    mediaType: 'video' as MediaType,
    videoQuality: 'high' as const,
    durationLimit: 600,
    includeBase64: false,
    includeExtra: true,
    storageOptions: {
      skipBackup: true,
      path: 'images',
    },
  };

  launchImageLibrary(options, async (response) => {
    if (response.didCancel) {
      console.log('User cancelled video selection');
    } else if (response.errorMessage) {
      console.log('ImagePicker Error: ', response.errorMessage);
      Alert.alert('Error', 'Failed to select video: ' + response.errorMessage);
    } else if (response.assets && response.assets[0]) {
      const video = response.assets[0];
      
      console.log('Video selection details:', {
        uri: video.uri,
        duration: video.duration,
        fileSize: video.fileSize,
        fileName: video.fileName,
        type: video.type
      });

      if (video.fileSize && video.fileSize > 500 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a video file smaller than 500MB');
        return;
      }

      // Try multiple sources for duration
      let duration = 0;
      
      // First try: from image picker response (in seconds, convert to ms)
      if (video.duration && video.duration > 0) {
        duration = Math.round(video.duration * 1000);
        console.log('Duration from picker (ms):', duration);
      }
      
      // Second try: use react-native-video-info if picker didn't provide duration
      if (!duration && video.uri) {
        console.log('Duration not available from picker, trying video-info...');
        duration = await getVideoDuration(video.uri);
      }
      
      // Third try: estimate from file size (very rough estimate)
      if (!duration && video.fileSize) {
        // Rough estimate: assume ~1MB per 10 seconds for typical video
        const estimatedSeconds = Math.max(30, (video.fileSize / (1024 * 1024)) * 10);
        duration = Math.round(estimatedSeconds * 1000);
        console.log('Using estimated duration (ms):', duration);
      }

      setSelectedVideo({
        uri: video.uri!,
        fileName: video.fileName || `volleyball_${Date.now()}.mp4`,
        fileSize: video.fileSize || 0,
        type: video.type || 'video/mp4',
        duration: duration,
      });
      
      console.log('Final selected video duration (ms):', duration);
      console.log('Final selected video duration (formatted):', formatDuration(duration));
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
  if (!milliseconds || milliseconds === 0) return 'Unknown';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  } else if (minutes < 60) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

  const createVideosDirectory = async (): Promise<string> => {
    const videosDir = `${RNFS.DocumentDirectoryPath}/VolleyballVideos`;
    
    try {
      const dirExists = await RNFS.exists(videosDir);
      if (!dirExists) {
        await RNFS.mkdir(videosDir);
        console.log('Created videos directory:', videosDir);
      }
      return videosDir;
    } catch (error) {
      console.error('Failed to create videos directory:', error);
      throw error;
    }
  };

  // Process video with ball tracking simulation
  const processVideoWithTracking = async () => {
    if (!isTrackingEnabled) return;
    
    setIsProcessing(true);
    setBallDetections([]);
    
    console.log('Starting video processing with ball tracking...');
    // TODO: Process video file with OpenCV
    // TODO: Extract frames and run ball detection on each frame
    // TODO: Collect all ball detections throughout the video
    setIsProcessing(false);
    
    console.log('Video processing completed. Ball detections:', ballDetections.length);
  };

  const saveVideoLocally = async () => {
    if (!selectedVideo || !videoTitle.trim()) {
      Alert.alert('Error', 'Please select a video and enter a title');
      return;
    }

    console.log('Starting local save process...');
    console.log('Selected video details:', selectedVideo);

    setSaving(true);
    setSaveProgress(0);

    try {
      // Process video with ball tracking if enabled
      if (isTrackingEnabled) {
        setSaveProgress(10);
        await processVideoWithTracking();
        setSaveProgress(25);
      }

      const videosDir = await createVideosDirectory();
      
      const timestamp = Date.now();
      const sanitizedTitle = videoTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const videoId = `${timestamp}_${sanitizedTitle}`;
      const fileExtension = selectedVideo.fileName.split('.').pop() || 'mp4';
      const localFileName = `${videoId}.${fileExtension}`;
      const localPath = `${videosDir}/${localFileName}`;
      
      console.log('Local save path:', localPath);
      
      let sourceUri = selectedVideo.uri;
      if (Platform.OS === 'android' && sourceUri.startsWith('content://')) {
        console.log('Using Android content URI:', sourceUri);
      } else if (sourceUri.startsWith('file://')) {
        sourceUri = sourceUri.replace('file://', '');
      }
      
      console.log('Source URI for copy:', sourceUri);
      
      setSaveProgress(50);
      console.log('Copying video file...');
      
      await RNFS.copyFile(sourceUri, localPath);
      setSaveProgress(75);
      
      const fileExists = await RNFS.exists(localPath);
      if (!fileExists) {
        throw new Error('Failed to copy video file');
      }
      
      const fileStat = await RNFS.stat(localPath);
      if (fileStat.size === 0) {
        throw new Error('Copied video file is empty');
      }
      
      console.log('Video copied successfully. Size:', fileStat.size);
      setSaveProgress(90);
      
      const videoMetadata: SavedVideo = {
        id: videoId,
        title: videoTitle.trim(),
        description: description.trim(),
        fileName: localFileName,
        fileSize: selectedVideo.fileSize,
        duration: selectedVideo.duration,
        localPath: localPath,
        ballColors: {
          primary: ballColors.primary,
          secondary: ballColors.secondary,
        },
        gameType,
        createdAt: new Date().toISOString(),
        processed: isTrackingEnabled,
        status: 'saved',
        ballDetections: ballDetections,
        trackingSettings: trackingSettings,
      };
      
      const existingVideos = await AsyncStorage.getItem('saved_videos');
      const videosList: SavedVideo[] = existingVideos ? JSON.parse(existingVideos) : [];
      videosList.unshift(videoMetadata);
      
      await AsyncStorage.setItem('saved_videos', JSON.stringify(videosList));
      setSaveProgress(100);
      
      console.log('Video metadata saved. Total videos:', videosList.length);
      console.log('Ball tracking data included:', ballDetections.length, 'detections');
      
      Alert.alert(
        'Video Saved Successfully! 🏐',
        `Your volleyball video has been saved locally${isTrackingEnabled ? ' with ball tracking data' : ''} and is ready for analysis.${isTrackingEnabled ? `\n\nBall detections: ${ballDetections.length}` : ''}`,
        [
          {
            text: 'View Saved Videos',
            onPress: () => navigation?.navigate('SavedVideos'),
          },
          {
            text: 'Save Another',
            onPress: () => {
              setSelectedVideo(null);
              setVideoTitle('');
              setDescription('');
              setBallColors({ primary: 'yellow', secondary: 'blue' });
              setGameType('indoor');
              setBallDetections([]);
            },
          },
          {
            text: 'Go Home',
            onPress: () => navigation?.navigate('Home'),
            style: 'cancel',
          },
        ]
      );
      
    } catch (error: any) {
      console.error('Save error details:', error);
      
      let errorMessage = 'Failed to save video locally. Please try again.';
      
      if (error.message?.includes('No such file or directory')) {
        errorMessage = 'Video file not accessible. Please select the video again.';
      } else if (error.message?.includes('Permission denied')) {
        errorMessage = 'Permission denied. Please check app permissions in device settings.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Selected video file could not be found. Please select the video again.';
      } else if (error.message?.includes('No space left')) {
        errorMessage = 'Not enough storage space on device. Please free up some space and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Save Failed', errorMessage);
    } finally {
      setSaving(false);
      setSaveProgress(0);
      setIsProcessing(false);
      stopTracking();
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
            setSaveProgress(0);
            setBallDetections([]);
            stopTracking();
          },
        },
      ]
    );
  };

  // Custom Slider Component to replace the removed Slider
  const CustomSlider = ({ value, minimumValue, maximumValue, onValueChange, label }) => {
    const [sliderValue, setSliderValue] = useState(value);
    
    const handleSliderChange = (newValue: number) => {
      setSliderValue(newValue);
      onValueChange(newValue);
    };

    return (
      <View style={styles.customSliderContainer}>
        <Text style={styles.sliderLabel}>{label}: {Math.round(sliderValue)}</Text>
        <View style={styles.sliderTrack}>
          <View 
            style={[
              styles.sliderFill, 
              { width: `${((sliderValue - minimumValue) / (maximumValue - minimumValue)) * 100}%` }
            ]} 
          />
          <TouchableOpacity
            style={[
              styles.sliderThumb,
              { 
                left: `${((sliderValue - minimumValue) / (maximumValue - minimumValue)) * 100}%`,
                marginLeft: -10
              }
            ]}
            onPress={() => {
              // Simple increment/decrement for now
              const step = (maximumValue - minimumValue) / 20;
              const newValue = Math.min(maximumValue, sliderValue + step);
              handleSliderChange(newValue);
            }}
          />
        </View>
        <View style={styles.sliderButtons}>
          <TouchableOpacity
            style={styles.sliderButton}
            onPress={() => {
              const step = (maximumValue - minimumValue) / 20;
              const newValue = Math.max(minimumValue, sliderValue - step);
              handleSliderChange(newValue);
            }}
          >
            <Text style={styles.sliderButtonText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sliderButton}
            onPress={() => {
              const step = (maximumValue - minimumValue) / 20;
              const newValue = Math.min(maximumValue, sliderValue + step);
              handleSliderChange(newValue);
            }}
          >
            <Text style={styles.sliderButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const BallTrackingSettings = () => (
    <View style={styles.section}>
      <View style={styles.trackingHeader}>
        <Text style={styles.sectionTitle}>Ball Tracking Settings 🏐</Text>
        <TouchableOpacity
          style={[
            styles.trackingToggle,
            isTrackingEnabled && styles.trackingToggleActive
          ]}
          onPress={toggleTracking}
          disabled={saving}
        >
          <Text style={styles.trackingToggleText}>
            {isTrackingEnabled ? '🎾 ON' : '🎾 OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Ball Detection Preview */}
      {isTrackingEnabled && (
        <View style={styles.trackingPreview}>
          <Text style={styles.previewTitle}>Ball Detection Preview</Text>
          <View style={styles.previewArea}>
            {ballDetected && (
              <View
                style={[
                  styles.ballIndicator,
                  {
                    left: (ballPosition.x * 200) / width,
                    top: (ballPosition.y * 100) / screenHeight,
                  },
                ]}
              />
            )}
            <Text style={styles.previewText}>
              {isProcessing ? 
                `🔍 Processing... (${ballDetections.length} detections)` :
                ballDetected ? '🎾 Ball Detected!' : '🔍 Searching for ball...'
              }
            </Text>
          </View>
        </View>
      )}
      
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

      {isTrackingEnabled && (
        <>
          <TouchableOpacity
            style={styles.advancedSettingsButton}
            onPress={() => setShowSettings(!showSettings)}
          >
            <Text style={styles.advancedSettingsText}>
              {showSettings ? '▼' : '▶'} Advanced Tracking Settings
            </Text>
          </TouchableOpacity>

          {showSettings && (
            <View style={styles.advancedSettings}>
              <CustomSlider
                label="Hue Max"
                value={trackingSettings.hueMax}
                minimumValue={0}
                maximumValue={180}
                onValueChange={(value) => setTrackingSettings(prev => ({...prev, hueMax: Math.round(value)}))}
              />
              
              <CustomSlider
                label="Min Radius"
                value={trackingSettings.minRadius}
                minimumValue={5}
                maximumValue={50}
                onValueChange={(value) => setTrackingSettings(prev => ({...prev, minRadius: Math.round(value)}))}
              />

              <CustomSlider
                label="Max Radius"
                value={trackingSettings.maxRadius}
                minimumValue={50}
                maximumValue={200}
                onValueChange={(value) => setTrackingSettings(prev => ({...prev, maxRadius: Math.round(value)}))}
              />
            </View>
          )}
        </>
      )}

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
        <Text style={styles.title}>Save Volleyball Video 🏐</Text>
        <Text style={styles.subtitle}>
          Save your volleyball game locally for AI-powered ball tracking analysis
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

          <BallTrackingSettings />
        </>
      )}

      {/* Save Progress */}
      {saving && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isProcessing ? 'Processing with Ball Tracking...' : `Saving Video... ${saveProgress}%`}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${saveProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {isProcessing ? 
              `Analyzing video for ball tracking... (${ballDetections.length} detections found)` :
              'Saving video to device storage...'
            }
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {selectedVideo && (
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!videoTitle.trim() || saving) && styles.saveButtonDisabled,
            ]}
            onPress={saveVideoLocally}
            disabled={!videoTitle.trim() || saving}
          >
            {saving ? (
              <View style={styles.savingContainer}>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.saveButtonText}>
                  {isProcessing ? 'Processing...' : 'Saving...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>
                💾 Save Video {isTrackingEnabled ? 'with Tracking' : 'Locally'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 Videos are saved to your device - no internet required!
        </Text>
        <Text style={styles.footerText}>
          🔒 Your videos stay private and secure on your device
        </Text>
        {isTrackingEnabled && (
          <Text style={styles.footerText}>
            🎾 Ball tracking analysis will be performed during save
          </Text>
        )}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 32,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  selectButtonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  selectButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  selectButtonSubtext: {
    fontSize: 14,
    color: '#B3D9FF',
    textAlign: 'center',
  },
  videoInfo: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoPreview: {
    backgroundColor: '#F0F0F0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  videoDetails: {
    padding: 16,
    backgroundColor: '#F8F9FA',
  },
  videoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 16,
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
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1D1D1F',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  trackingToggle: {
    backgroundColor: '#E5E5E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  trackingToggleActive: {
    backgroundColor: '#34C759',
  },
  trackingToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  trackingPreview: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  previewArea: {
    height: 100,
    backgroundColor: '#E5E5E5',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  previewText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  colorButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  advancedSettingsButton: {
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  advancedSettingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  advancedSettings: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  customSliderContainer: {
    marginVertical: 12,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    position: 'relative',
    marginBottom: 8,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderButton: {
    backgroundColor: '#007AFF',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameTypeButtons: {
    gap: 12,
  },
  gameTypeButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
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
    marginVertical: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#B0B0B0',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default UploadScreen;