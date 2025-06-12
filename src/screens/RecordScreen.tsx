import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  StatusBar,
  BackHandler,
  Slider,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const RecordScreen = ({ navigation }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [flashMode, setFlashMode] = useState('off');
  const [cameraType, setCameraType] = useState('back');
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    camera: 'checking',
    microphone: 'checking'
  });
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [ballDetected, setBallDetected] = useState(false);
  const [ballPosition, setBallPosition] = useState({ x: 0, y: 0 });
  const [trackingSettings, setTrackingSettings] = useState({
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
  const [cameraDevicesReady, setCameraDevicesReady] = useState(false);

  const devices = useCameraDevices();
  const device = devices[cameraType];
  const camera = useRef(null);
  const timerRef = useRef(null);
  const trackingRef = useRef(null);
  const recordingStartTime = useRef(null); // Add ref to track start time

  // Debug camera devices
  useEffect(() => {
    console.log('Available camera devices:', devices);
    console.log('Current camera type:', cameraType);
    console.log('Selected device:', device);
    
    // Check if devices are loaded
    if (devices && Object.keys(devices).length > 0) {
      setCameraDevicesReady(true);
      
      // If current device type is not available, try to find an alternative
      if (!device) {
        if (devices.back) {
          console.log('Switching to back camera');
          setCameraType('back');
        } else if (devices.front) {
          console.log('Switching to front camera');
          setCameraType('front');
        } else if (devices.external) {
          console.log('Switching to external camera');
          setCameraType('external');
        } else {
          // Try to get the first available device
          const availableTypes = Object.keys(devices);
          if (availableTypes.length > 0) {
            console.log('Switching to first available camera:', availableTypes[0]);
            setCameraType(availableTypes[0]);
          }
        }
      }
    } else {
      setCameraDevicesReady(false);
    }
  }, [devices, device, cameraType]);

  useEffect(() => {
    checkPermissions();
    
    // Handle back button during recording
    const backAction = () => {
      if (isRecording) {
        Alert.alert(
          'Recording in Progress',
          'Stop recording before going back?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Stop & Go Back', 
              onPress: () => {
                stopRecording();
                if (navigation) navigation.goBack();
              }
            },
          ]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    
    return () => {
      // Clean up timers and intervals on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (trackingRef.current) {
        clearInterval(trackingRef.current);
        trackingRef.current = null;
      }
      backHandler.remove();
    };
  }, [isRecording, navigation]);

  // Add useEffect to handle recording state changes
  useEffect(() => {
    if (isRecording) {
      startTimer();
    } else {
      stopTimer();
    }
    
    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const checkPermissions = async () => {
    try {
      console.log('Checking camera permissions...');
      
      const currentCameraPermission = await Camera.getCameraPermissionStatus();
      const currentMicPermission = await Camera.getMicrophonePermissionStatus();
      
      console.log('Current camera permission:', currentCameraPermission);
      console.log('Current microphone permission:', currentMicPermission);
      
      setPermissionStatus({
        camera: currentCameraPermission,
        microphone: currentMicPermission
      });

      const isGranted = (status) => status === 'authorized' || status === 'granted';

      if (isGranted(currentCameraPermission) && isGranted(currentMicPermission)) {
        console.log('Permissions already granted');
        setHasPermission(true);
        return;
      }

      // Request permissions
      let cameraPermission = currentCameraPermission;
      let micPermission = currentMicPermission;

      if (!isGranted(currentCameraPermission)) {
        console.log('Requesting camera permission...');
        cameraPermission = await Camera.requestCameraPermission();
        console.log('Camera permission result:', cameraPermission);
        
        // Wait a bit for Android to process
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!isGranted(currentMicPermission)) {
        console.log('Requesting microphone permission...');
        micPermission = await Camera.requestMicrophonePermission();
        console.log('Microphone permission result:', micPermission);
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setPermissionStatus({
        camera: cameraPermission,
        microphone: micPermission
      });

      if (isGranted(cameraPermission) && isGranted(micPermission)) {
        console.log('All permissions granted successfully');
        setHasPermission(true);
      } else {
        console.log('Permission issues:', { camera: cameraPermission, microphone: micPermission });
        
        Alert.alert(
          'Permissions Required',
          `Camera and microphone permissions are required.\n\nStatus:\nCamera: ${cameraPermission}\nMicrophone: ${micPermission}\n\nPlease enable them in device settings.`,
          [
            { text: 'Cancel', onPress: () => navigation && navigation.goBack() },
            { text: 'Retry', onPress: checkPermissions },
            { text: 'Continue Anyway', onPress: () => setHasPermission(true) },
          ]
        );
      }
    } catch (error) {
      console.error('Permission check error:', error);
      Alert.alert(
        'Permission Error',
        `Error checking permissions: ${error.message}`,
        [
          { text: 'Retry', onPress: checkPermissions },
          { text: 'Continue Anyway', onPress: () => setHasPermission(true) },
        ]
      );
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Record the start time
    recordingStartTime.current = Date.now();
    
    // Start the timer
    timerRef.current = setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - recordingStartTime.current) / 1000);
      setRecordingTime(elapsedTime);
    }, 1000);
    
    console.log('Timer started');
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log('Timer stopped');
    }
  };

  const processCameraFrame = (frame) => {
    if (!isTrackingEnabled) return;

    try {
      // SIMULATION MODE - Replace with actual OpenCV implementation
      const simulatedDetection = Math.random() > 0.7;
      if (simulatedDetection) {
        const x = Math.random() * screenWidth;
        const y = Math.random() * (screenHeight * 0.6) + (screenHeight * 0.2);
        runOnJS(setBallDetected)(true);
        runOnJS(setBallPosition)({ x, y, radius: 30 });
      } else {
        runOnJS(setBallDetected)(false);
      }
    } catch (error) {
      console.error('Frame processing error:', error);
    }
  };

  const startTracking = () => {
    if (trackingRef.current) return;
    
    trackingRef.current = setInterval(() => {
      processCameraFrame(null);
    }, 100);
  };

  const stopTracking = () => {
    if (trackingRef.current) {
      clearInterval(trackingRef.current);
      trackingRef.current = null;
    }
    setBallDetected(false);
  };

  const startRecording = async () => {
    if (!camera.current) {
      Alert.alert('Error', 'Camera is not ready');
      return;
    }

    try {
      console.log('Starting recording with ball tracking...');
      
      // Reset timer first
      setRecordingTime(0);
      
      // Set recording state - this will trigger the useEffect to start the timer
      setIsRecording(true);
      
      if (isTrackingEnabled) {
        startTracking();
      }

      await camera.current.startRecording({
        flash: flashMode === 'on' ? 'on' : 'off',
        onRecordingFinished: (video) => {
          console.log('Recording finished:', video);
          // Calculate final duration
          const finalDuration = recordingStartTime.current 
            ? Math.floor((Date.now() - recordingStartTime.current) / 1000)
            : recordingTime;
          saveRecording(video.path, finalDuration);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          Alert.alert('Recording Error', 'Failed to record video');
          resetRecording();
        },
      });
    } catch (error) {
      console.error('Start recording error:', error);
      Alert.alert('Error', `Failed to start recording: ${error.message}`);
      resetRecording();
    }
  };

  const stopRecording = async () => {
    if (camera.current && isRecording) {
      try {
        console.log('Stopping recording...');
        await camera.current.stopRecording();
        
        // The recording state will be reset in the onRecordingFinished callback
        // or we can set it here if needed
        setIsRecording(false);
        stopTracking();
      } catch (error) {
        console.error('Stop recording error:', error);
        Alert.alert('Error', 'Failed to stop recording');
        resetRecording();
      }
    }
  };

  const saveRecording = async (videoPath, finalDuration = recordingTime) => {
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const timestamp = new Date();
      const videoData = {
        userId: user.uid,
        videoPath: videoPath,
        duration: finalDuration, // Use the final calculated duration
        timestamp: timestamp,
        flashUsed: flashMode === 'on',
        cameraType: cameraType,
        trackingEnabled: isTrackingEnabled,
        trackingSettings: trackingSettings,
        ballDetections: [],
      };

      await firestore()
        .collection('recordings')
        .add(videoData);

      console.log('Recording with tracking data saved to Firestore');
      
      Alert.alert(
        'Recording Saved',
        `Video with ball tracking recorded successfully! Duration: ${formatTime(finalDuration)}`,
        [
          { text: 'Record Another', onPress: resetRecording },
          { text: 'Go Back', onPress: () => navigation && navigation.goBack() },
        ]
      );
    } catch (error) {
      console.error('Save recording error:', error);
      Alert.alert('Error', 'Failed to save recording');
    }
  };

  const resetRecording = () => {
    setRecordingTime(0);
    setIsRecording(false);
    stopTimer();
    stopTracking();
    setBallDetected(false);
    recordingStartTime.current = null;
    console.log('Recording reset');
  };

  const toggleFlash = () => {
    setFlashMode(prev => prev === 'off' ? 'on' : 'off');
  };

  const toggleCamera = () => {
    const availableTypes = Object.keys(devices).filter(type => devices[type]);
    const currentIndex = availableTypes.indexOf(cameraType);
    const nextIndex = (currentIndex + 1) % availableTypes.length;
    setCameraType(availableTypes[nextIndex]);
  };

  const toggleTracking = () => {
    setIsTrackingEnabled(prev => !prev);
    if (!isTrackingEnabled && isRecording) {
      startTracking();
    } else if (isTrackingEnabled) {
      stopTracking();
    }
  };

  const onCameraReady = () => {
    setCameraReady(true);
    console.log('Camera is ready for ball tracking');
  };

  // Show permission status for debugging
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Permission Status</Text>
          <Text style={styles.permissionText}>
            Camera: {permissionStatus.camera}
          </Text>
          <Text style={styles.permissionText}>
            Microphone: {permissionStatus.microphone}
          </Text>
          <Text style={styles.permissionDescription}>
            Camera and microphone permissions are required for ball tracking and recording.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={checkPermissions}
          >
            <Text style={styles.retryButtonText}>Retry Permissions</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={() => setHasPermission(true)}
          >
            <Text style={styles.skipButtonText}>Continue Anyway (Testing)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Enhanced debugging for device availability
  if (!cameraDevicesReady) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Loading Camera</Text>
          <Text style={styles.permissionText}>
            Initializing camera devices...
          </Text>
          <Text style={styles.permissionDescription}>
            Available devices: {Object.keys(devices).join(', ') || 'None'}
          </Text>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Not Available</Text>
          <Text style={styles.permissionText}>
            Selected camera type: {cameraType}
          </Text>
          <Text style={styles.permissionText}>
            Available devices: {Object.keys(devices).join(', ') || 'None'}
          </Text>
          <Text style={styles.permissionDescription}>
            This could be due to:
            {'\n'}• Camera being used by another app
            {'\n'}• Hardware issues
            {'\n'}• App permissions not properly granted
            {'\n'}• Device doesn't have the requested camera type
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              // Try to switch to any available camera
              const availableTypes = Object.keys(devices).filter(type => devices[type]);
              if (availableTypes.length > 0) {
                setCameraType(availableTypes[0]);
              }
            }}
          >
            <Text style={styles.retryButtonText}>Try Different Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={checkPermissions}
          >
            <Text style={styles.skipButtonText}>Refresh Permissions</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6b8e23" />
      
      <Camera
        ref={camera}
        style={styles.camera}
        device={device}
        isActive={true}
        video={true}
        audio={true}
        onInitialized={onCameraReady}
      />

      {/* Ball Tracking Overlay */}
      {ballDetected && isTrackingEnabled && (
        <View
          style={[
            styles.ballIndicator,
            {
              left: ballPosition.x - (ballPosition.radius || 30),
              top: ballPosition.y - (ballPosition.radius || 30),
              width: (ballPosition.radius || 30) * 2,
              height: (ballPosition.radius || 30) * 2,
            },
          ]}
        />
      )}

      {/* Top Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation && navigation.goBack()}
          disabled={isRecording}
        >
          <Text style={styles.controlButtonText}>✕</Text>
        </TouchableOpacity>
        
        <View style={styles.statusContainer}>
          <View style={styles.timerContainer}>
            <View style={[styles.recordingIndicator, isRecording && styles.recordingActive]} />
            <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
          </View>
          
          {isTrackingEnabled && (
            <View style={[styles.trackingStatus, ballDetected && styles.trackingActive]}>
              <Text style={styles.trackingText}>
                {ballDetected ? '🎾 TRACKING' : '🔍 SEARCHING'}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowSettings(!showSettings)}
          disabled={isRecording}
        >
          <Text style={styles.controlButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Tracking Settings Panel */}
      {showSettings && !isRecording && (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsTitle}>Ball Tracking Settings</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Hue Range: {trackingSettings.hueMin}-{trackingSettings.hueMax}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={180}
              value={trackingSettings.hueMax}
              onValueChange={(value) => setTrackingSettings(prev => ({...prev, hueMax: Math.round(value)}))}
              minimumTrackTintColor="#6b8e23"
              maximumTrackTintColor="#c8e6c9"
              thumbStyle={{backgroundColor: '#6b8e23'}}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Min Radius: {trackingSettings.minRadius}</Text>
            <Slider
              style={styles.slider}
              minimumValue={5}
              maximumValue={50}
              value={trackingSettings.minRadius}
              onValueChange={(value) => setTrackingSettings(prev => ({...prev, minRadius: Math.round(value)}))}
              minimumTrackTintColor="#6b8e23"
              maximumTrackTintColor="#c8e6c9"
              thumbStyle={{backgroundColor: '#6b8e23'}}
            />
          </View>
        </View>
      )}

      {/* Middle Controls */}
      <View style={styles.middleControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={toggleFlash}
          disabled={isRecording}
        >
          <Text style={styles.controlButtonText}>
            {flashMode === 'on' ? '⚡' : '🔦'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.trackingButton,
            isTrackingEnabled && styles.trackingButtonActive
          ]}
          onPress={toggleTracking}
          disabled={isRecording}
        >
          <Text style={styles.trackingButtonText}>
            {isTrackingEnabled ? '🎾 ON' : '🎾 OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={toggleCamera}
          disabled={isRecording}
        >
          <Text style={styles.controlButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.controlButton} />

        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!cameraReady}
        >
          <View style={[
            styles.recordButtonInner,
            isRecording && styles.recordButtonInnerActive
          ]} />
        </TouchableOpacity>

        <View style={styles.controlButton} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5e8',
  },
  camera: {
    flex: 1,
    borderRadius: 15,
    margin: 10,
    overflow: 'hidden',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f0f8f0',
    margin: 20,
    borderRadius: 15,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 20,
  },
  permissionText: {
    color: '#2d5016',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionDescription: {
    color: '#2d5016',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 25,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#6b8e23',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    backgroundColor: '#a5d6a7',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  skipButtonText: {
    color: '#2d5016',
    fontSize: 14,
    fontWeight: 'bold',
  },
  topControls: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 30,
  },
  middleControls: {
    position: 'absolute',
    top: '50%',
    right: 20,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 15,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  controlButton: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: 'rgba(107, 142, 35, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6b8e23',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    gap: 10,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 142, 35, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#6b8e23',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a5d6a7',
    marginRight: 10,
  },
  recordingActive: {
    backgroundColor: '#8bc34a',
  },
  timerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  trackingStatus: {
    backgroundColor: 'rgba(165, 214, 167, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  trackingActive: {
    backgroundColor: 'rgba(139, 195, 74, 0.9)',
  },
  trackingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trackingButton: {
    backgroundColor: 'rgba(165, 214, 167, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  trackingButtonActive: {
    backgroundColor: 'rgba(139, 195, 74, 0.9)',
  },
  trackingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ballIndicator: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#8bc34a',
    borderRadius: 50,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  settingsPanel: {
    position: 'absolute',
    top: 150,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(240, 248, 240, 0.95)',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#6b8e23',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 15,
    textAlign: 'center',
  },
  settingRow: {
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d5016',
    marginBottom: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  recordButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f0f8f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#6b8e23',
    shadowColor: '#6b8e23',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  recordButtonActive: {
    backgroundColor: '#8bc34a',
    borderColor: '#2d5016',
  },
  recordButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6b8e23',
  },
  recordButtonInnerActive: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: '#f0f8f0',
  },
});

export default RecordScreen;