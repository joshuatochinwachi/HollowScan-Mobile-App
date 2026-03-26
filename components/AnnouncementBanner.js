import React, { useEffect, useRef } from 'react';
import { 
    StyleSheet, 
    View, 
    Text, 
    Animated, 
    Dimensions, 
    TouchableOpacity, 
    Linking,
    Easing
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnnouncementBanner = ({ message, isDarkMode, colors }) => {
    if (!message) return null;

    const scrollX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
    const textWidth = useRef(0);

    useEffect(() => {
        const startAnimation = () => {
            // Speed calculation: roughly 50 pixels per second
            // We scroll from SCREEN_WIDTH to -textWidth
            const totalDistance = SCREEN_WIDTH + (textWidth.current || 500);
            const duration = totalDistance * 20; // adjuts speed here

            scrollX.setValue(SCREEN_WIDTH);
            
            Animated.timing(scrollX, {
                toValue: -(textWidth.current || 500),
                duration: duration,
                easing: Easing.linear,
                useNativeDriver: true,
                isInteraction: false
            }).start(({ finished }) => {
                if (finished) startAnimation();
            });
        };

        // Small delay to allow layout
        const timer = setTimeout(startAnimation, 500);
        return () => {
            clearTimeout(timer);
            scrollX.stopAnimation();
        };
    }, [message]);

    const renderMessage = (text) => {
        // Simple regex to split text and links: [Text](URL)
        const parts = text.split(/(\[.+?\]\(.+?\))/g);
        return (
            <Text 
                numberOfLines={1} 
                style={[styles.message, { color: colors.text }]}
                onLayout={(e) => {
                    // Capture text width for precise animation looping
                    textWidth.current = e.nativeEvent.layout.width;
                }}
            >
                {parts.map((part, index) => {
                    const match = part.match(/\[(.+?)\]\((.+?)\)/);
                    if (match) {
                        return (
                            <Text 
                                key={index} 
                                style={[styles.link, { color: '#60A5FA' }]} 
                                onPress={() => Linking.openURL(match[2].trim())}
                            >
                                {match[1]}
                            </Text>
                        );
                    }
                    return <Text key={index}>{part}</Text>;
                })}
            </Text>
        );
    };

    return (
        <View style={[styles.container, { 
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : '#F0F7FF', 
            borderColor: colors.border,
            borderBottomWidth: 1 
        }]}>
            <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#111' : '#E0EFFF' }]}>
                <Text style={styles.icon}>📢</Text>
            </View>
            <View style={styles.tickerContainer}>
                <Animated.View style={[styles.tickerWrapper, { transform: [{ translateX: scrollX }] }]}>
                    {renderMessage(message)}
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 34,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },
    iconContainer: {
        width: 38,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderEndWidth: 1,
        borderEndColor: 'rgba(255,255,255,0.05)',
    },
    icon: {
        fontSize: 12,
    },
    tickerContainer: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
    },
    tickerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        // Important: Position absolute to avoid layout shifts
        position: 'absolute',
        left: 0,
    },
    message: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    link: {
        textDecorationLine: 'underline',
        fontWeight: '800',
    }
});

export default AnnouncementBanner;
