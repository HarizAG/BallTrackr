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

const { width: screenWidth } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'tracked', 'recorded', 'uploaded', 'local'

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

  const playVideo = (video) => {
    if (video.source === 'local') {
      // For local videos, show more detailed info including ball tracking data
      const trackingInfo = video.trackingEnabled 
        ? `Ball Tracking: Enabled\nDetections: ${video.ballDetections?.length || 0}\nBall Colors: ${video.ballColors?.primary || 'Unknown'}${video.ballColors?.secondary && video.ballColors.secondary !== 'none' ? `, ${video.ballColors.secondary}` : ''}\nGame Type: ${video.gameType || 'Unknown'}`
        : 'Ball Tracking: Disabled';
      
      Alert.alert(
        'Local Video Info',
        `Title: ${video.title}\nDuration: ${formatDuration(video.duration)}\nFile Size: ${formatFileSize(video.fileSize)}\nSaved: ${formatDate(video.timestamp)}\n\n${trackingInfo}${video.description ? `\n\nDescription: ${video.description}` : ''}`,
        [
          { text: 'OK' },
          {
            text: 'View Details',
            onPress: () => {
              // Navigate to a detailed view if you have one
              console.log('Local video details:', video);
            }
          }
        ]
      );
    } else {
      // For cloud videos, show basic info
      Alert.alert(
        'Video Info', 
        `Duration: ${formatDuration(video.duration)}\nTracking: ${video.trackingEnabled ? 'Enabled' : 'Disabled'}\nSource: ${video.type}`
      );
    }
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
                item.source === 'recorded' ? styles.recordedBadge : 
                item.source === 'uploaded' ? styles.uploadedBadge :
                item.source === 'local' ? styles.localBadge : styles.uploadedBadge
              ]}>
                <Text style={styles.badgeText}>{item.type}</Text>
              </View>
              {item.trackingEnabled && (
                <View style={styles.trackingBadge}>
                  <Text style={styles.badgeText}>🎾 TRACKED</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.videoDate}>{formatDate(item.timestamp)}</Text>
          
          {/* Tracking Info */}
          {item.trackingEnabled && (
            <View style={styles.trackingInfo}>
              <Text style={styles.trackingText}>
                Ball tracking enabled
                {item.ballDetections && ` • ${item.ballDetections.length} detections`}
                {item.cameraType && ` • Camera: ${item.cameraType}`}
              </Text>
              {item.flashUsed && (
                <Text style={styles.trackingText}>Flash used</Text>
              )}
              {item.ballColors && (
                <Text style={styles.trackingText}>
                  Ball: {item.ballColors.primary}
                  {item.ballColors.secondary && item.ballColors.secondary !== 'none' && `, ${item.ballColors.secondary}`}
                </Text>
              )}
            </View>
          )}

          {/* Video Stats */}
          <View style={styles.videoStats}>
            <Text style={styles.statText}>
              Duration: {formatDuration(item.duration)}
            </Text>
            {item.fileSize && (
              <Text style={styles.statText}>
                Size: {formatFileSize(item.fileSize)}
              </Text>
            )}
            {item.ballDetections && (
              <Text style={styles.statText}>
                Detections: {item.ballDetections.length || 0}
              </Text>
            )}
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteVideo(item)}
        >
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderFilterButton = (filterType, label) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && styles.filterButtonActive
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b8e23" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  const filteredVideos = getFilteredVideos();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ball Tracking Videos</Text>
        <Text style={styles.headerSubtitle}>
          {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''} 
          {videos.filter(v => v.source === 'local').length > 0 && 
            ` • ${videos.filter(v => v.source === 'local').length} local`}
        </Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All')}
        {renderFilterButton('tracked', 'Tracked')}
        {renderFilterButton('local', 'Local')}
        {renderFilterButton('recorded', 'Recorded')}
        {renderFilterButton('uploaded', 'Uploaded')}
      </View>

      {/* Videos List */}
      <FlatList
        data={filteredVideos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => `${item.source}-${item.id}`}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6b8e23']}
            tintColor="#6b8e23"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎾</Text>
            <Text style={styles.emptyTitle}>No videos found</Text>
            <Text style={styles.emptyText}>
              {filter === 'tracked' 
                ? 'No videos with ball tracking found'
                : filter === 'recorded'
                ? 'No recorded videos found'
                : filter === 'uploaded'
                ? 'No uploaded videos found'
                : filter === 'local'
                ? 'No locally saved videos found'
                : 'Start recording or uploading videos with ball tracking'
              }
            </Text>
            <View style={styles.emptyButtonContainer}>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation?.navigate('Record')}
              >
                <Text style={styles.emptyButtonText}>📹 Record Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyButton, styles.emptyButtonSecondary]}
                onPress={() => navigation?.navigate('Upload')}
              >
                <Text style={[styles.emptyButtonText, styles.emptyButtonTextSecondary]}>
                  📱 Save Local Video
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => navigation?.navigate('Upload')}
        >
          <Text style={styles.fabText}>📱</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation?.navigate('Record')}
        >
          <Text style={styles.fabText}>📹</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f8f0',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b8e23',
  },
  header: {
    backgroundColor: '#6b8e23',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#c8e6c9',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  filterButtonActive: {
    backgroundColor: '#6b8e23',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingBottom: 100, // Extra padding for FABs
  },
  videoItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#6b8e23',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoContent: {
    flexDirection: 'row',
    padding: 15,
  },
  thumbnailContainer: {
    marginRight: 15,
  },
  thumbnail: {
    width: 80,
    height: 80,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  thumbnailText: {
    fontSize: 30,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
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
    fontWeight: '600',
    color: '#2d5016',
    flex: 1,
    marginRight: 10,
  },
  badges: {
    flexDirection: 'row',
    gap: 5,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  recordedBadge: {
    backgroundColor: '#6b8e23',
  },
  uploadedBadge: {
    backgroundColor: '#8bc34a',
  },
  localBadge: {
    backgroundColor: '#4285f4',
  },
  trackingBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  videoDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  trackingInfo: {
    marginBottom: 8,
  },
  trackingText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  videoStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statText: {
    fontSize: 12,
    color: '#999',
    marginRight: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  emptyButtonContainer: {
    flexDirection: 'row',
    gap: 15,
  },
  emptyButton: {
    backgroundColor: '#6b8e23',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#6b8e23',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyButtonTextSecondary: {
    color: '#6b8e23',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    flexDirection: 'column',
    gap: 15,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6b8e23',
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
  fabSecondary: {
    backgroundColor: '#4285f4',
  },
  fabText: {
    fontSize: 24,
  },
});

export default HomeScreen;

