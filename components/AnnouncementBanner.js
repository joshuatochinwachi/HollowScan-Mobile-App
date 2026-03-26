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
        const parts = text.split(/(\[.+?\]\(.+?\))/g);
        return (
            <View 
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onLayout={(e) => {
                    // Capture actual width of the unconstrained text
                    const width = e.nativeEvent.layout.width;
                    if (width > 0) textWidth.current = width;
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
                    return <Text key={index} style={[styles.message, { color: colors.text }]}>{part}</Text>;
                })}
                {/* Extra spacing at the end for a cleaner loop */}
                <Text style={{ width: 100 }}>{"          "}</Text>
            </View>
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
            <View style={styles.tickerOuter}>
                <Animated.View 
                    style={[
                        styles.tickerWrapper, 
                        { transform: [{ translateX: scrollX }] }
                    ]}
                >
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
    tickerOuter: {
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        justifyContent: 'center',
    },
    tickerWrapper: {
        // Absolute position allows it to expand beyond the parent width
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
    },
    message: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    link: {
        fontSize: 13,
        textDecorationLine: 'underline',
        fontWeight: '800',
    }
});

export default AnnouncementBanner;
