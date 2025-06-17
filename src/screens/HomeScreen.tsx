import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import VideoPlayerWithTracking from './VideoPlayerWithTracking'; // Import the new component

const { width: screenWidth } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'tracked', 'recorded', 'uploaded', 'local'
  
  // Video player state
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchLocalVideos = async () => {
    try {
      const savedVideos = await AsyncStorage.getItem('saved_videos');
      const localVideos = savedVideos ? JSON.parse(savedVideos) : [];
      
      // Convert local videos to match the expected format
      return localVideos.map(video => ({
        id: video.id,
        title: video.title,
        description: video.description,
        duration: Math.floor(video.duration / 1000), // Convert ms to seconds
        timestamp: { toDate: () => new Date(video.createdAt) },
        source: 'local',
        type: 'Local Save',
        trackingEnabled: video.processed,
        ballDetections: video.ballDetections || [],
        localPath: video.localPath,
        fileName: video.fileName,
        fileSize: video.fileSize,
        ballColors: video.ballColors,
        gameType: video.gameType,
        trackingSettings: video.trackingSettings,
      }));
    } catch (error) {
      console.error('Error fetching local videos:', error);
      return [];
    }
  };

  const fetchCloudVideos = async () => {
    try {
      const user = auth().currentUser;
      
      if (!user) {
        console.log('User not authenticated, skipping cloud videos');
        return [];
      }

      // Fetch from recordings collection (RecordScreen videos)
      const recordingsSnapshot = await firestore()
        .collection('recordings')
        .where('userId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .get();

      // Fetch from videos collection (UploadScreen videos) - assuming similar structure
      const videosSnapshot = await firestore()
        .collection('videos')
        .where('userId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .get();

      const recordedVideos = recordingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'recorded',
        type: 'Recording'
      }));

      const uploadedVideos = videosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'uploaded',
        type: 'Upload'
      }));

      return [...recordedVideos, ...uploadedVideos];
    } catch (error) {
      console.error('Error fetching cloud videos:', error);
      return [];
    }
  };

  const fetchVideos = async () => {
    try {
      setLoading(true);
      
      // Fetch both local and cloud videos in parallel
      const [localVideos, cloudVideos] = await Promise.all([
        fetchLocalVideos(),
        fetchCloudVideos()
      ]);

      // Combine and sort by timestamp
      const allVideos = [...localVideos, ...cloudVideos].sort((a, b) => {
        const timestampA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const timestampB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return timestampB - timestampA;
      });

      setVideos(allVideos);
    } catch (error) {
      console.error('Error fetching videos:', error);
      Alert.alert('Error', 'Failed to load some videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVideos();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFilteredVideos = () => {
    switch (filter) {
      case 'tracked':
        return videos.filter(video => video.trackingEnabled === true);
      case 'recorded':
        return videos.filter(video => video.source === 'recorded');
      case 'uploaded':
        return videos.filter(video => video.source === 'uploaded');
      case 'local':
        return videos.filter(video => video.source === 'local');
      default:
        return videos;
    }
  };

  const deleteLocalVideo = async (videoId) => {
    try {
      // Get current videos from AsyncStorage
      const savedVideos = await AsyncStorage.getItem('saved_videos');
      const videosList = savedVideos ? JSON.parse(savedVideos) : [];
      
      // Find the video to get its local path
      const videoToDelete = videosList.find(v => v.id === videoId);
      
      if (videoToDelete) {
        // Delete the physical file if it exists
        try {
          const fileExists = await RNFS.exists(videoToDelete.localPath);
          if (fileExists) {
            await RNFS.unlink(videoToDelete.localPath);
            console.log('Video file deleted:', videoToDelete.localPath);
          }
        } catch (fileError) {
          console.warn('Could not delete video file:', fileError);
        }
      }
      
      // Remove from AsyncStorage
      const updatedVideos = videosList.filter(v => v.id !== videoId);
      await AsyncStorage.setItem('saved_videos', JSON.stringify(updatedVideos));
      
      // Remove from local state
      setVideos(prev => prev.filter(video => video.id !== videoId));
      
      Alert.alert('Success', 'Local video deleted successfully');
    } catch (error) {
      console.error('Error deleting local video:', error);
      Alert.alert('Error', 'Failed to delete local video');
    }
  };

  const deleteCloudVideo = async (videoId, source) => {
    try {
      const collection = source === 'recorded' ? 'recordings' : 'videos';
      await firestore().collection(collection).doc(videoId).delete();
      
      // Remove from local state
      setVideos(prev => prev.filter(video => video.id !== videoId));
      
      Alert.alert('Success', 'Cloud video deleted successfully');
    } catch (error) {
      console.error('Error deleting cloud video:', error);
      Alert.alert('Error', 'Failed to delete cloud video');
    }
  };

  const deleteVideo = async (video) => {
    const videoTitle = video.title || `${video.type} - ${formatDate(video.timestamp)}`;
    const storageType = video.source === 'local' ? 'device storage' : 'cloud';
    
    Alert.alert(
      'Delete Video',
      `Are you sure you want to delete "${videoTitle}" from ${storageType}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (video.source === 'local') {
              await deleteLocalVideo(video.id);
            } else {
              await deleteCloudVideo(video.id, video.source);
            }
          }
        }
      ]
    );
  };

  // Updated playVideo function to open video player
  const playVideo = (video) => {
    console.log('Playing video:', video.title);
    setSelectedVideo(video);
    setShowVideoPlayer(true);
  };

  const closeVideoPlayer = () => {
    setShowVideoPlayer(false);
    setSelectedVideo(null);
  };

  const renderVideoItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.videoItem}
      onPress={() => playVideo(item)}
    >
      <View style={styles.videoContent}>
        {/* Video Thumbnail Placeholder */}
        <View style={styles.thumbnailContainer}>
          <View style={styles.thumbnail}>
            <Text style={styles.thumbnailText}>
              {item.source === 'local' ? '📱' : '🎥'}
            </Text>
            <Text style={styles.durationBadge}>
              {formatDuration(item.duration)}
            </Text>
            {/* Play button overlay */}
            <View style={styles.playButtonOverlay}>
              <Text style={styles.playButton}>▶️</Text>
            </View>
          </View>
        </View>

        {/* Video Info */}
        <View style={styles.videoInfo}>
          <View style={styles.videoHeader}>
            <Text style={styles.videoTitle}>
              {item.title || `${item.type} - ${formatDate(item.timestamp)}`}
            </Text>
            <View style={styles.badges}>
              <View style={[styles.typeBadge, 
                item.source === 'local' ? styles.localBadge : 
                item.source === 'recorded' ? styles.recordedBadge : styles.uploadedBadge
              ]}>
                <Text style={styles.typeBadgeText}>{item.type}</Text>
              </View>
              {item.trackingEnabled && (
                <View style={styles.trackingBadge}>
                  <Text style={styles.trackingBadgeText}>🎾 Tracked</Text>
                </View>
              )}
            </View>
          </View>

          {/* Video Details */}
          <Text style={styles.videoDate}>{formatDate(item.timestamp)}</Text>
          
          {item.description && (
            <Text style={styles.videoDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              ⏱️ {formatDuration(item.duration)}
            </Text>
            {item.ballDetections && item.ballDetections.length > 0 && (
              <Text style={styles.statText}>
                🎾 {item.ballDetections.length} detections
              </Text>
            )}
            {item.fileSize && (
              <Text style={styles.statText}>
                💾 {formatFileSize(item.fileSize)}
              </Text>
            )}
          </View>

          {/* Game Info */}
          {item.gameType && (
            <View style={styles.gameInfo}>
              <Text style={styles.gameInfoText}>
                🏐 {item.gameType}
              </Text>
              {item.ballColors && (
                <Text style={styles.gameInfoText}>
                  🎨 {item.ballColors.primary}
                  {item.ballColors.secondary && item.ballColors.secondary !== 'none' 
                    ? `, ${item.ballColors.secondary}` : ''}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.videoActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              deleteVideo(item);
            }}
          >
            <Text style={styles.actionButtonText}>🗑️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert(
                'Video Details',
                `Title: ${item.title || 'Untitled'}\n` +
                `Duration: ${formatDuration(item.duration)}\n` +
                `Created: ${formatDate(item.timestamp)}\n` +
                `Source: ${item.type}\n` +
                `Tracking: ${item.trackingEnabled ? 'Enabled' : 'Disabled'}\n` +
                `Ball Detections: ${item.ballDetections?.length || 0}\n` +
                `File Size: ${formatFileSize(item.fileSize)}\n` +
                `Game Type: ${item.gameType || 'Unknown'}\n` +
                `Ball Colors: ${item.ballColors ? 
                  `${item.ballColors.primary}${item.ballColors.secondary && item.ballColors.secondary !== 'none' ? `, ${item.ballColors.secondary}` : ''}` 
                  : 'Unknown'}`
              );
            }}
          >
            <Text style={styles.actionButtonText}>ℹ️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilterButton = (filterType, label, icon) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === filterType && styles.activeFilterButton]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[styles.filterButtonText, filter === filterType && styles.activeFilterButtonText]}>
        {icon} {label}
      </Text>
    </TouchableOpacity>
  );

  const filteredVideos = getFilteredVideos();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b8e23" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Videos</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Text style={styles.refreshButtonText}>
            {refreshing ? '⟳' : '↻'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', '📹')}
        {renderFilterButton('tracked', 'Tracked', '🎾')}
        {renderFilterButton('local', 'Local', '📱')}
        {renderFilterButton('recorded', 'Recorded', '🎬')}
        {renderFilterButton('uploaded', 'Uploaded', '☁️')}
      </View>

      {/* Videos List */}
      {filteredVideos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>
            {filter === 'all' ? '📹' : 
             filter === 'tracked' ? '🎾' : 
             filter === 'local' ? '📱' : 
             filter === 'recorded' ? '🎬' : '☁️'}
          </Text>
          <Text style={styles.emptyTitle}>
            {filter === 'all' ? 'No videos found' : 
             `No ${filter} videos found`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all' ? 
              'Start by recording or uploading a video' : 
              `You don't have any ${filter} videos yet`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredVideos}
          renderItem={renderVideoItem}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6b8e23']}
              tintColor="#6b8e23"
            />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Video Player Modal */}
      <VideoPlayerWithTracking
        video={selectedVideo}
        visible={showVideoPlayer}
        onClose={closeVideoPlayer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#6b8e23',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  activeFilterButton: {
    backgroundColor: '#6b8e23',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  listContainer: {
    padding: 15,
  },
  videoItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  videoContent: {
    flexDirection: 'row',
    padding: 15,
  },
  thumbnailContainer: {
    marginRight: 15,
  },
  thumbnail: {
    width: 120,
    height: 80,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  thumbnailText: {
    fontSize: 24,
    color: '#fff',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  playButton: {
    fontSize: 20,
    color: '#fff',
  },
  videoInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  badges: {
    alignItems: 'flex-end',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 3,
  },
  localBadge: {
    backgroundColor: '#4CAF50',
  },
  recordedBadge: {
    backgroundColor: '#2196F3',
  },
  uploadedBadge: {
    backgroundColor: '#FF9800',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  trackingBadge: {
    backgroundColor: '#6b8e23',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trackingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  videoDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  videoDescription: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 5,
  },
  statText: {
    fontSize: 11,
    color: '#888',
    marginRight: 15,
    marginBottom: 2,
  },
  gameInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gameInfoText: {
    fontSize: 11,
    color: '#6b8e23',
    marginRight: 15,
    fontWeight: '500',
  },
  videoActions: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionButton: {
    padding: 8,
    marginVertical: 2,
  },
  actionButtonText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HomeScreen;