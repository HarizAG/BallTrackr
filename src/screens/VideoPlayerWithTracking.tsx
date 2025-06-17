import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import Video from 'react-native-video';
import Svg, { Circle, Polyline } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const VideoPlayerWithTracking = ({ video, visible, onClose }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(null);
  
  const videoRef = useRef(null);
  const hideControlsTimeout = useRef(null);

  // Reset state when video changes
  useEffect(() => {
    if (visible && video) {
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setIsLoading(true);
      setVideoError(null);
      setShowControls(true);
    }
  }, [visible, video]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [showControls, isPlaying]);

  const toggleControls = () => {
    setShowControls(!showControls);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    setShowControls(true);
  };

  const onVideoLoad = (data) => {
    console.log('Video loaded:', data);
    setDuration(data.duration);
    setIsLoading(false);
  };

  const onVideoProgress = (data) => {
    setCurrentTime(data.currentTime);
  };

  const onVideoError = (error) => {
    console.error('Video error:', error);
    setVideoError(error.error || 'Failed to load video');
    setIsLoading(false);
  };

  const onVideoEnd = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setShowControls(true);
  };

  // Get ball positions that should be visible at current time
  const getCurrentBallPositions = () => {
    if (!video?.ballDetections || !duration) return [];
    
    // Convert video timestamps to relative time (0 to duration)
    const videoStartTime = video.ballDetections[0]?.timestamp || 0;
    const currentVideoTime = currentTime * 1000; // Convert to milliseconds
    
    // Get positions within a small time window around current time
    const timeWindow = 100; // 100ms window
    const currentTimestamp = videoStartTime + currentVideoTime;
    
    return video.ballDetections.filter(detection => {
      const detectionTime = detection.timestamp - videoStartTime;
      const videoTime = currentVideoTime;
      return Math.abs(detectionTime - videoTime) <= timeWindow;
    });
  };

  // Get trajectory path up to current time
  const getTrajectoryPath = () => {
    if (!video?.ballDetections || !duration) return [];
    
    const videoStartTime = video.ballDetections[0]?.timestamp || 0;
    const currentVideoTime = currentTime * 1000;
    
    return video.ballDetections.filter(detection => {
      const detectionTime = detection.timestamp - videoStartTime;
      return detectionTime <= currentVideoTime;
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekTo = (position) => {
    if (videoRef.current && duration > 0) {
      const seekTime = position * duration;
      videoRef.current.seek(seekTime);
      setCurrentTime(seekTime);
    }
  };

  if (!video) return null;

  // Handle simulation videos (no actual video file)
  if (!video.localPath || video.localPath === '') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.simulationContainer}>
            <Text style={styles.simulationTitle}>📊 Tracking Data Visualization</Text>
            <Text style={styles.simulationSubtitle}>{video.title}</Text>
            
            {/* Static visualization of all ball positions */}
            <View style={styles.trackingCanvas}>
              <Svg style={styles.svg}>
                {/* Draw full trajectory */}
                {video.ballDetections && video.ballDetections.length > 1 && (
                  <Polyline
                    points={video.ballDetections.map(pos => `${pos.x},${pos.y}`).join(' ')}
                    fill="none"
                    stroke="#ff4444"
                    strokeWidth="3"
                    strokeOpacity="0.8"
                  />
                )}
                
                {/* Draw all ball positions */}
                {video.ballDetections && video.ballDetections.map((pos, index) => (
                  <Circle
                    key={index}
                    cx={pos.x}
                    cy={pos.y}
                    r={Math.max(3, 10 - (video.ballDetections.length - index) * 0.2)}
                    fill={`rgba(255, 68, 68, ${Math.max(0.2, 1 - (video.ballDetections.length - index) * 0.05)})`}
                    stroke="#ff4444"
                    strokeWidth="1"
                  />
                ))}
              </Svg>
            </View>
            
            {/* Stats */}
            <View style={styles.statsContainer}>
              <Text style={styles.statText}>
                🎾 Total Ball Detections: {video.ballDetections?.length || 0}
              </Text>
              <Text style={styles.statText}>
                ⏱️ Duration: {Math.floor((video.duration || 0) / 1000)}s
              </Text>
              <Text style={styles.statText}>
                🎮 Game Type: {video.gameType || 'Unknown'}
              </Text>
              <Text style={styles.statText}>
                🎨 Ball Colors: {video.ballColors?.primary || 'Unknown'}
                {video.ballColors?.secondary && video.ballColors.secondary !== 'none' 
                  ? `, ${video.ballColors.secondary}` : ''}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕ Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.videoContainer} 
          activeOpacity={1}
          onPress={toggleControls}
        >
          {/* Video Player */}
          <Video
            ref={videoRef}
            source={{ uri: `file://${video.localPath}` }}
            style={styles.video}
            onLoad={onVideoLoad}
            onProgress={onVideoProgress}
            onError={onVideoError}
            onEnd={onVideoEnd}
            paused={!isPlaying}
            resizeMode="contain"
            repeat={false}
          />
          
          {/* Ball Tracking Overlay */}
          {video.trackingEnabled && (
            <Svg style={styles.overlay}>
              {/* Draw trajectory path up to current time */}
              {(() => {
                const trajectoryPath = getTrajectoryPath();
                return trajectoryPath.length > 1 && (
                  <Polyline
                    points={trajectoryPath.map(pos => `${pos.x},${pos.y}`).join(' ')}
                    fill="none"
                    stroke="#ff4444"
                    strokeWidth="3"
                    strokeOpacity="0.8"
                  />
                );
              })()}
              
              {/* Draw current ball positions */}
              {getCurrentBallPositions().map((pos, index) => (
                <Circle
                  key={`${pos.timestamp}-${index}`}
                  cx={pos.x}
                  cy={pos.y}
                  r="12"
                  fill="rgba(255, 68, 68, 0.7)"
                  stroke="#ff4444"
                  strokeWidth="2"
                />
              ))}
            </Svg>
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}
          
          {/* Error Message */}
          {videoError && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>❌ {videoError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => {
                setVideoError(null);
                setIsLoading(true);
              }}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Video Controls */}
        {showControls && (
          <View style={styles.controlsContainer}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <TouchableOpacity 
                style={styles.progressBar}
                onPress={(e) => {
                  const { locationX } = e.nativeEvent;
                  const progress = locationX / (screenWidth - 120);
                  seekTo(Math.max(0, Math.min(1, progress)));
                }}
              >
                <View style={styles.progressTrack}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                    ]} 
                  />
                </View>
              </TouchableOpacity>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
            
            {/* Control Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.controlButton} onPress={togglePlayPause}>
                <Text style={styles.controlButtonText}>
                  {isPlaying ? '⏸️' : '▶️'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.controlButton} onPress={() => seekTo(0)}>
                <Text style={styles.controlButtonText}>⏮️</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.infoButton} onPress={() => {
                Alert.alert(
                  'Video Info',
                  `${video.title}\n\n` +
                  `Duration: ${formatTime(duration)}\n` +
                  `Ball Detections: ${video.ballDetections?.length || 0}\n` +
                  `Tracking: ${video.trackingEnabled ? 'Enabled' : 'Disabled'}\n` +
                  `Game Type: ${video.gameType || 'Unknown'}\n` +
                  `File Size: ${video.fileSize ? formatFileSize(video.fileSize) : 'Unknown'}`
                );
              }}>
                <Text style={styles.controlButtonText}>ℹ️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        
        {/* Tracking Stats Overlay */}
        {video.trackingEnabled && showControls && (
          <View style={styles.trackingStats}>
            <Text style={styles.trackingStatsText}>
              🎾 Ball Tracking: ON
            </Text>
            <Text style={styles.trackingStatsText}>
              Detections: {video.ballDetections?.length || 0}
            </Text>
            <Text style={styles.trackingStatsText}>
              Time: {formatTime(currentTime)}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6b8e23',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    zIndex: 3,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    minWidth: 45,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    marginHorizontal: 15,
    height: 30,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6b8e23',
    borderRadius: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 25,
    minWidth: 50,
    alignItems: 'center',
  },
  infoButton: {
    backgroundColor: 'rgba(107,142,35,0.8)',
    padding: 12,
    borderRadius: 25,
    minWidth: 50,
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 20,
    zIndex: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  trackingStats: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 10,
    zIndex: 3,
  },
  trackingStatsText: {
    color: '#fff',
    fontSize: 12,
    marginVertical: 2,
  },
  // Simulation mode styles
  simulationContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  simulationTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  simulationSubtitle: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  trackingCanvas: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    margin: 10,
    position: 'relative',
  },
  svg: {
    flex: 1,
  },
  statsContainer: {
    backgroundColor: 'rgba(107,142,35,0.2)',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  statText: {
    color: '#fff',
    fontSize: 16,
    marginVertical: 5,
  },
});

export default VideoPlayerWithTracking;