import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Sparkles } from 'lucide-react-native';
import { THEME } from '../../styles/theme';
import AIInsightsModal from '../../components/AIInsightsModal';

const AttachmentViewerScreen = ({ route, navigation }) => {
  const { url, isPrescription } = route.params;
  const [loading, setLoading] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  
  const dummyInsights = {
    whats_right: ['Dosage is appropriate for your age.'],
    needs_attention: ['Potential interaction with currently taken Aspirin.'],
    telemetry_correlations: ['Your BP trend is stable.'],
    actionable_recommendations: ['Take after meals.']
  };

  const handleOpenAIInsights = () => {
    setShowAIModal(true);
    setIsAILoading(true);
    setTimeout(() => {
      setIsAILoading(false);
    }, 1500);
  };

  // If there's no extension or it's unknown from supabase, we could try to guess, but we'll check for typical image extensions.
  // Supabase public URLs might not have extensions at the end if they are just paths. 
  // Let's assume it's an image unless we know it's a pdf. But for safety, we'll render an Image and let it fail.
  // Wait, if it fails, onLoadEnd fires but we wouldn't know. 
  // Let's rely on basic extension matching, or always try Image and provide a fallback "Open in browser" button always!
  
  const handleOpenBrowser = async () => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error("Couldn't load page", err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={THEME.colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attachment Viewer</Text>
        {isPrescription ? (
          <TouchableOpacity style={styles.aiButton} onPress={handleOpenAIInsights}>
            <Sparkles size={20} color={THEME.colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      <View style={styles.content}>
        {loading && <ActivityIndicator style={styles.loader} size="large" color={THEME.colors.primary} />}
        <Image
          source={{ uri: url }}
          style={styles.image}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
        />
        
        {/* We provide this button overlay in case the image fails to load (e.g. it's a PDF) */}
        {!loading && (
          <View style={styles.overlayButtonContainer}>
            <TouchableOpacity style={styles.openButton} onPress={handleOpenBrowser}>
              <Text style={styles.openButtonText}>Open in External Browser</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <AIInsightsModal
        visible={showAIModal}
        onClose={() => setShowAIModal(false)}
        insights={dummyInsights}
        isLoading={isAILoading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Dark background for media viewer
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerTitle: {
    color: THEME.colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
  },
  overlayButtonContainer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  openButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    opacity: 0.9,
  },
  openButtonText: {
    color: THEME.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  aiButton: {
    padding: 8,
    backgroundColor: THEME.colors.white,
    borderRadius: 20,
  }
});

export default AttachmentViewerScreen;
