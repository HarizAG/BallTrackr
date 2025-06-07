// src/screens/ProfileScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      title: 'Edit Profile',
      onPress: () => {
        // TODO: Implement edit profile
        Alert.alert('Coming Soon', 'Edit profile feature coming soon!');
      },
    },
    {
      title: 'Give Feedback',
      onPress: () => {
        // TODO: Implement feedback
        Alert.alert('Coming Soon', 'Feedback feature coming soon!');
      },
    },
    {
      title: 'Contact Support',
      onPress: () => {
        // TODO: Implement support
        Alert.alert('Coming Soon', 'Support feature coming soon!');
      },
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.memberSince}>
          Member since {user?.metadata?.creationTime ? 
            new Date(user.metadata.creationTime).toLocaleDateString() : 
            'Unknown'
          }
        </Text>
      </View>

      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <Text style={styles.menuItemText}>{item.title}</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#666',
  },
  menuSection: {
    paddingTop: 24,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemArrow: {
    fontSize: 20,
    color: '#ccc',
  },
  logoutButton: {
    margin: 16,
    backgroundColor: '#ff3b30',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;