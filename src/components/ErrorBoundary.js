import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME } from '../styles/theme';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <View style={[styles.container, this.props.style]}>
          <Text style={styles.errorTitle}>Something went wrong.</Text>
          <Text style={styles.errorMessage}>{this.state.error?.message || "An unexpected error occurred in this AI component."}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children; 
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFEAEA',
    borderRadius: THEME.borderRadius.card || 12,
    borderWidth: 1,
    borderColor: '#FFCACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  errorTitle: {
    color: '#D32F2F',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  }
});

export default ErrorBoundary;
