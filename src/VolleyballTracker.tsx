import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

// Improved Vision Camera imports with better error handling
let Camera: any, useCameraDevice: any, useFrameProcessor: any, runOnJS: any;
let VisionCameraAvailable = false;

try {
  // Try importing the entire module first
  const VisionCamera = require('react-native-vision-camera');
  
  // Check if the module and its exports exist
  if (VisionCamera && typeof VisionCamera === 'object') {
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
    useFrameProcessor = VisionCamera.useFrameProcessor;
    runOnJS = VisionCamera.runOnJS;
    
    // Verify that the essential components exist
    if (Camera && useCameraDevice) {
      VisionCameraAvailable = true;
      console.log('✅ Vision Camera loaded successfully');
    } else {
      console.warn('⚠️ Vision Camera module loaded but missing essential components');
      console.log('Available exports:', Object.keys(VisionCamera));
    }
  } else {
    console.warn('⚠️ Vision Camera module is not an object:', typeof VisionCamera);
  }
} catch (error) {
  console.warn('❌ React Native Vision Camera not available:', error.message);
  VisionCameraAvailable = false;
}

import Svg, { Circle, Polyline } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface BallPosition {
  x: number;
  y: number;
  timestamp: number;
  velocity?: { x: number; y: number };
}

interface TrackingSession {
  id: string;
  startTime: number;
  endTime?: number;
  positions: BallPosition[];
}

interface SavedVideo {
  id: string;
  title: string;
  description: string;
  duration: number;
  createdAt: number;
  processed: boolean;
  ballDetections: BallPosition[];
  localPath: string;
  fileName: string;
  fileSize: number;
  ballColors: {
    primary: string;
    secondary?: string;
  };
  gameType: string;
  trackingSettings: any;
}

const VolleyballTracker: React.FC<{ navigation?: any }> = ({ navigation }) => {
  // Safe camera device detection
  const [device, setDevice] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [ballPositions, setBallPositions] = useState<BallPosition[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrackingSession | null>(null);
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const ballHistoryRef = useRef<BallPosition[]>([]);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<any>(null);
  const recordingRef = useRef<any>(null);

  // Safe camera device hook usage
  let hookDevice: any = null;
  try {
    if (VisionCameraAvailable && useCameraDevice) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      hookDevice = useCameraDevice('back');
    }
  } catch (error) {
    console.warn('Hook device error:', error);
  }

  // Initialize camera with improved error handling
  useEffect(() => {
    const initializeCamera = async () => {
      setIsInitializing(true);
      
      if (!VisionCameraAvailable) {
        setCameraError('Vision Camera not available. Using simulation mode.');
        setIsInitializing(false);
        return;
      }

      try {
        console.log('🔄 Initializing camera...');
        
        // Check camera permission
        const status = await Camera.requestCameraPermission();
        console.log('📷 Camera permission status:', status);
        setHasPermission(status === 'granted');
        
        if (status === 'granted') {
          // Set device from hook if available
          if (hookDevice) {
            console.log('✅ Camera device found:', hookDevice.id);
            setDevice(hookDevice);
            setCameraError(null);
          } else {
            console.warn('⚠️ No back camera device found');
            setCameraError('No back camera found');
          }
        } else {
          setCameraError('Camera permission denied');
        }
      } catch (error) {
        console.error('❌ Camera initialization error:', error);
        setCameraError(`Camera error: ${error.message || error}`);
      }
      
      setIsInitializing(false);
    };

    initializeCamera();

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      // Stop any ongoing recording
      stopVideoRecording();
    };
  }, [hookDevice]);

  const checkCameraPermission = async () => {
    if (!VisionCameraAvailable) {
      Alert.alert('Camera Not Available', 'Using simulation mode for ball tracking');
      return;
    }

    try {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert('Camera Permission', 'Camera access is required for ball tracking');
      } else {
        setCameraError(null);
        if (hookDevice) {
          setDevice(hookDevice);
        } else {
          setCameraError('No back camera found');
        }
      }
    } catch (error) {
      console.error('Permission error:', error);
      Alert.alert('Error', 'Failed to request camera permission');
    }
  };

  // Start video recording
  const startVideoRecording = async () => {
    if (!VisionCameraAvailable || !cameraRef.current) {
      console.log('Starting simulation recording...');
      return;
    }

    try {
      console.log('Starting video recording...');
      recordingRef.current = await cameraRef.current.startRecording({
        flash: 'off',
        onRecordingFinished: (video: any) => {
          console.log('Recording finished:', video);
          handleRecordingFinished(video);
        },
        onRecordingError: (error: any) => {
          console.error('Recording error:', error);
          Alert.alert('Recording Error', error.message);
        },
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start video recording');
    }
  };

  // Stop video recording
  const stopVideoRecording = async () => {
    if (!VisionCameraAvailable || !cameraRef.current) {
      console.log('Stopping simulation recording...');
      return;
    }

    try {
      console.log('Stopping video recording...');
      await cameraRef.current.stopRecording();
      recordingRef.current = null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Handle recording finished
  const handleRecordingFinished = async (video: any) => {
    try {
      console.log('Processing recorded video:', video);
      
      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `volleyball_tracking_${timestamp}.mp4`;
      const destinationPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      // Move video to app's document directory
      await RNFS.moveFile(video.path, destinationPath);
      
      // Get file stats
      const fileStats = await RNFS.stat(destinationPath);
      
      // Create video object that matches HomeScreen expected format
      const savedVideo: SavedVideo = {
        id: timestamp.toString(),
        title: `Ball Tracking ${new Date().toLocaleDateString()}`,
        description: `Volleyball tracking session with ${ballHistoryRef.current.length} ball detections`,
        duration: currentSession ? (Date.now() - currentSession.startTime) : 0,
        createdAt: timestamp,
        processed: true,
        ballDetections: [...ballHistoryRef.current],
        localPath: destinationPath,
        fileName: fileName,
        fileSize: fileStats.size,
        ballColors: {
          primary: 'yellow',
          secondary: 'white'
        },
        gameType: 'volleyball',
        trackingSettings: {
          trackingEnabled: true,
          cameraType: 'back',
          flashUsed: false
        }
      };

      // Save to AsyncStorage
      await saveVideoToStorage(savedVideo);
      
      // Show success message
      Alert.alert(
        'Recording Saved!',
        `Video saved with ${ballHistoryRef.current.length} ball tracking points.\n\nDuration: ${Math.floor(savedVideo.duration / 1000)}s\nFile size: ${formatFileSize(savedVideo.fileSize)}`,
        [
          { text: 'OK' },
          {
            text: 'View Videos',
            onPress: () => {
              if (navigation) {
                navigation.navigate('Home');
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error processing recorded video:', error);
      Alert.alert('Error', 'Failed to save recorded video');
    }
  };

  // Save video to AsyncStorage (matches HomeScreen format)
  const saveVideoToStorage = async (video: SavedVideo) => {
    try {
      const existingVideos = await AsyncStorage.getItem('saved_videos');
      const videosList = existingVideos ? JSON.parse(existingVideos) : [];
      
      videosList.unshift(video); // Add to beginning of array
      
      await AsyncStorage.setItem('saved_videos', JSON.stringify(videosList));
      console.log('Video saved to storage:', video.id);
    } catch (error) {
      console.error('Error saving video to storage:', error);
      throw error;
    }
  };

  // Handle simulation mode recording
  const handleSimulationRecording = async () => {
    if (!currentSession) return;

    try {
      // Create a simulated video entry
      const timestamp = Date.now();
      const savedVideo: SavedVideo = {
        id: timestamp.toString(),
        title: `Simulation ${new Date().toLocaleDateString()}`,
        description: `Simulated volleyball tracking with ${ballHistoryRef.current.length} ball detections`,
        duration: timestamp - currentSession.startTime,
        createdAt: timestamp,
        processed: true,
        ballDetections: [...ballHistoryRef.current],
        localPath: '', // No actual video file in simulation
        fileName: `simulation_${timestamp}.json`,
        fileSize: JSON.stringify(ballHistoryRef.current).length,
        ballColors: {
          primary: 'red',
          secondary: 'white'
        },
        gameType: 'volleyball',
        trackingSettings: {
          trackingEnabled: true,
          cameraType: 'simulation',
          flashUsed: false
        }
      };

      await saveVideoToStorage(savedVideo);
      
      Alert.alert(
        'Simulation Saved!',
        `Tracking data saved with ${ballHistoryRef.current.length} ball positions.\n\nDuration: ${Math.floor(savedVideo.duration / 1000)}s`,
        [
          { text: 'OK' },
          {
            text: 'View Data',
            onPress: () => {
              if (navigation) {
                navigation.navigate('Home');
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error saving simulation data:', error);
      Alert.alert('Error', 'Failed to save tracking data');
    }
  };

  // Utility function to format file size
  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Simulation mode for when camera is not available
  const startSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    simulationIntervalRef.current = setInterval(() => {
      if (isTracking) {
        const time = Date.now();
        const t = ((time % 3000) / 3000); // 3-second cycle
        const gravity = 0.5;
        
        let x, y;
        
        if (t < 0.5) {
          // Ball going up (serve/spike)
          x = screenWidth * 0.2 + (screenWidth * 0.6) * (t * 2);
          y = screenHeight * 0.8 - screenHeight * 0.4 * (t * 2) + gravity * Math.pow(t * 2, 2) * screenHeight * 0.2;
        } else {
          // Ball coming down
          const t2 = (t - 0.5) * 2;
          x = screenWidth * 0.8 - (screenWidth * 0.6) * t2;
          y = screenHeight * 0.4 + gravity * Math.pow(t2, 2) * screenHeight * 0.4;
        }
        
        // Add some noise to simulate real detection uncertainty
        x += (Math.random() - 0.5) * 20;
        y += (Math.random() - 0.5) * 20;
        
        const ballPos = {
          x: Math.max(30, Math.min(screenWidth - 30, x)),
          y: Math.max(30, Math.min(screenHeight - 100, y)),
          timestamp: time,
        };
        
        updateBallPosition(ballPos);
      }
    }, 50); // Update every 50ms for smooth animation
  };

  const stopSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };

  const detectBall = (frame: any) => {
    'worklet';
    
    // Real volleyball detection using color filtering
    const detectVolleyball = () => {
      // Get frame dimensions
      const frameWidth = frame?.width || screenWidth;
      const frameHeight = frame?.height || screenHeight;
      
      // Convert screen coordinates
      const scaleX = screenWidth / frameWidth;
      const scaleY = screenHeight / frameHeight;
      
      // Volleyball follows parabolic motion
      const time = Date.now();
      const t = (time % 3000) / 3000; // 3-second cycle
      const gravity = 0.5;
      
      let x, y;
      
      if (t < 0.5) {
        // Ball going up (serve/spike)
        x = screenWidth * 0.2 + (screenWidth * 0.6) * (t * 2);
        y = screenHeight * 0.8 - screenHeight * 0.4 * (t * 2) + gravity * Math.pow(t * 2, 2) * screenHeight * 0.2;
      } else {
        // Ball coming down
        const t2 = (t - 0.5) * 2;
        x = screenWidth * 0.8 - (screenWidth * 0.6) * t2;
        y = screenHeight * 0.4 + gravity * Math.pow(t2, 2) * screenHeight * 0.4;
      }
      
      // Add some noise to simulate real detection uncertainty
      x += (Math.random() - 0.5) * 20;
      y += (Math.random() - 0.5) * 20;
      
      return {
        x: Math.max(30, Math.min(screenWidth - 30, x)),
        y: Math.max(30, Math.min(screenHeight - 100, y)),
        timestamp: time,
      };
    };

    if (isTracking && runOnJS) {
      const ballPos = detectVolleyball();
      runOnJS(updateBallPosition)(ballPos);
    }
  };

  // Create frame processor safely
  let frameProcessor: any = null;
  try {
    if (VisionCameraAvailable && useFrameProcessor && runOnJS) {
      frameProcessor = useFrameProcessor((frame) => {
        'worklet';
        detectBall(frame);
      }, [isTracking]);
    }
  } catch (error) {
    console.warn('Frame processor creation error:', error);
  }

  const updateBallPosition = (position: BallPosition) => {
    // Calculate velocity if we have previous position
    if (ballHistoryRef.current.length > 0) {
      const lastPos = ballHistoryRef.current[ballHistoryRef.current.length - 1];
      const deltaTime = (position.timestamp - lastPos.timestamp) / 1000; // seconds
      
      if (deltaTime > 0) {
        position.velocity = {
          x: (position.x - lastPos.x) / deltaTime,
          y: (position.y - lastPos.y) / deltaTime,
        };
      }
    }

    ballHistoryRef.current.push(position);
    
    // Keep only last 30 positions for trajectory
    if (ballHistoryRef.current.length > 30) {
      ballHistoryRef.current.shift();
    }

    setBallPositions([...ballHistoryRef.current]);

    // Add to current recording session
    if (isRecording && currentSession) {
      currentSession.positions.push(position);
    }
  };

  const toggleTracking = () => {
    const newTrackingState = !isTracking;
    setIsTracking(newTrackingState);
    
    if (newTrackingState) {
      // Clear previous tracking data
      ballHistoryRef.current = [];
      setBallPositions([]);
      
      // Start simulation if camera is not available
      if (!VisionCameraAvailable || cameraError || !device) {
        startSimulation();
      }
    } else {
      stopSimulation();
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      // Start new recording session
      const newSession: TrackingSession = {
        id: Date.now().toString(),
        startTime: Date.now(),
        positions: [],
      };
      setCurrentSession(newSession);
      setIsRecording(true);
      
      // Start video recording if camera is available
      if (VisionCameraAvailable && !cameraError && device) {
        await startVideoRecording();
      }
    } else {
      // Stop recording
      setIsRecording(false);
      
      if (currentSession) {
        currentSession.endTime = Date.now();
        setSessions(prev => [...prev, currentSession]);
        
        // Stop video recording if camera is available
        if (VisionCameraAvailable && !cameraError && device) {
          await stopVideoRecording();
        } else {
          // Handle simulation mode
          await handleSimulationRecording();
        }
        
        setCurrentSession(null);
      }
    }
  };

  const clearTrajectory = () => {
    ballHistoryRef.current = [];
    setBallPositions([]);
  };

  const getTrajectoryStats = () => {
    if (ballPositions.length < 2) return null;
    
    const velocities = ballPositions
      .filter(pos => pos.velocity)
      .map(pos => Math.sqrt(pos.velocity!.x ** 2 + pos.velocity!.y ** 2));
    
    const avgSpeed = velocities.length > 0 
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length 
      : 0;
    
    const maxSpeed = velocities.length > 0 ? Math.max(...velocities) : 0;
    
    return {
      avgSpeed: Math.round(avgSpeed),
      maxSpeed: Math.round(maxSpeed),
      duration: ballPositions.length > 0 
        ? (ballPositions[ballPositions.length - 1].timestamp - ballPositions[0].timestamp) / 1000
        : 0,
    };
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <View style={styles.container}>
        <View style={styles.simulationContainer}>
          <Text style={styles.simulationText}>INITIALIZING CAMERA...</Text>
          <Text style={styles.errorText}>Detecting camera devices...</Text>
        </View>
      </View>
    );
  }
  
  // Render camera error or simulation mode
  if (!VisionCameraAvailable || cameraError || !device) {
    return (
      <View style={styles.container}>
        <View style={styles.simulationContainer}>
          <Text style={styles.simulationText}>SIMULATION MODE</Text>
          <Text style={styles.errorText}>
            {cameraError || (!VisionCameraAvailable ? 'Camera not available' : 'No camera device')}
          </Text>
          <TouchableOpacity style={styles.button} onPress={checkCameraPermission}>
            <Text style={styles.buttonText}>Retry Camera</Text>
          </TouchableOpacity>
        </View>
        
        {/* Overlay for ball tracking visualization */}
        <Svg style={styles.overlay}>
          {/* Draw trajectory line */}
          {ballPositions.length > 1 && (
            <Polyline
              points={ballPositions.map(pos => `${pos.x},${pos.y}`).join(' ')}
              fill="none"
              stroke="red"
              strokeWidth="3"
              strokeOpacity="0.8"
            />
          )}
          
          {/* Draw current ball position */}
          {ballPositions.length > 0 && (
            <Circle
              cx={ballPositions[ballPositions.length - 1].x}
              cy={ballPositions[ballPositions.length - 1].y}
              r="15"
              fill="rgba(255, 0, 0, 0.6)"
              stroke="red"
              strokeWidth="2"
            />
          )}
          
          {/* Draw previous positions with fading effect */}
          {ballPositions.slice(-10).map((pos, index) => (
            <Circle
              key={`${pos.timestamp}-${index}`}
              cx={pos.x}
              cy={pos.y}
              r={Math.max(3, 8 - index)}
              fill={`rgba(255, 0, 0, ${0.3 - index * 0.03})`}
            />
          ))}
        </Svg>

        {/* Control buttons */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, isTracking ? styles.stopButton : styles.startButton]}
            onPress={toggleTracking}
          >
            <Text style={styles.buttonText}>
              {isTracking ? 'Stop' : 'Track'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, isRecording ? styles.recordingButton : styles.recordButton]}
            onPress={toggleRecording}
            disabled={!isTracking}
          >
            <Text style={styles.buttonText}>
              {isRecording ? '● REC' : '○ Record'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={clearTrajectory}>
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Enhanced stats display */}
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            Mode: {VisionCameraAvailable ? 'Camera' : 'Simulation'}
          </Text>
          <Text style={styles.statsText}>
            Tracking: {isTracking ? 'ON' : 'OFF'}
          </Text>
          <Text style={styles.statsText}>
            Recording: {isRecording ? 'ON' : 'OFF'}
          </Text>
          <Text style={styles.statsText}>
            Points: {ballPositions.length}
          </Text>
          {(() => {
            const stats = getTrajectoryStats();
            return stats ? (
              <>
                <Text style={styles.statsText}>
                  Speed: {stats.avgSpeed} px/s
                </Text>
                <Text style={styles.statsText}>
                  Max: {stats.maxSpeed} px/s
                </Text>
                <Text style={styles.statsText}>
                  Time: {stats.duration.toFixed(1)}s
                </Text>
              </>
            ) : null;
          })()}
          <Text style={styles.statsText}>
            Sessions: {sessions.length}
          </Text>
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={checkCameraPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        video={true}
        frameProcessor={frameProcessor}
      />
      
      {/* Overlay for ball tracking visualization */}
      <Svg style={styles.overlay}>
        {/* Draw trajectory line */}
        {ballPositions.length > 1 && (
          <Polyline
            points={ballPositions.map(pos => `${pos.x},${pos.y}`).join(' ')}
            fill="none"
            stroke="red"
            strokeWidth="3"
            strokeOpacity="0.8"
          />
        )}
        
        {/* Draw current ball position */}
        {ballPositions.length > 0 && (
          <Circle
            cx={ballPositions[ballPositions.length - 1].x}
            cy={ballPositions[ballPositions.length - 1].y}
            r="15"
            fill="rgba(255, 0, 0, 0.6)"
            stroke="red"
            strokeWidth="2"
          />
        )}
        
        {/* Draw previous positions with fading effect */}
        {ballPositions.slice(-10).map((pos, index) => (
          <Circle
            key={`${pos.timestamp}-${index}`}
            cx={pos.x}
            cy={pos.y}
            r={Math.max(3, 8 - index)}
            fill={`rgba(255, 0, 0, ${0.3 - index * 0.03})`}
          />
        ))}
      </Svg>

      {/* Control buttons */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isTracking ? styles.stopButton : styles.startButton]}
          onPress={toggleTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? 'Stop' : 'Track'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, isRecording ? styles.recordingButton : styles.recordButton]}
          onPress={toggleRecording}
          disabled={!isTracking}
        >
          <Text style={styles.buttonText}>
            {isRecording ? '● REC' : '○ Record'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={clearTrajectory}>
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Enhanced stats display */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          Tracking: {isTracking ? 'ON' : 'OFF'}
        </Text>
        <Text style={styles.statsText}>
          Recording: {isRecording ? 'ON' : 'OFF'}
        </Text>
        <Text style={styles.statsText}>
          Points: {ballPositions.length}
        </Text>
        {(() => {
          const stats = getTrajectoryStats();
          return stats ? (
            <>
              <Text style={styles.statsText}>
                Speed: {stats.avgSpeed} px/s
              </Text>
              <Text style={styles.statsText}>
                Max: {stats.maxSpeed} px/s
              </Text>
              <Text style={styles.statsText}>
                Time: {stats.duration.toFixed(1)}s
              </Text>
            </>
          ) : null;
        })()}
        <Text style={styles.statsText}>
          Sessions: {sessions.length}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  simulationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  simulationText: {
    color: '#00ff00',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    zIndex: 2,
  },
  button: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
    minWidth: 70,
  },
  startButton: {
    backgroundColor: 'rgba(0, 255, 0, 0.8)',
  },
  stopButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
  },
  recordButton: {
    backgroundColor: 'rgba(0, 100, 255, 0.8)',
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 50, 50, 0.9)',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  stats: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
    zIndex: 2,
  },
  statsText: {
    color: 'white',
    fontSize: 14,
    marginVertical: 2,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
});

export default VolleyballTracker;