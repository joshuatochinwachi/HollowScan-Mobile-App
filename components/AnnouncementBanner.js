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
        let isCancelled = false;
        
        const startAnimation = () => {
            if (isCancelled) return;
            
            // Speed calculation
            const totalDistance = SCREEN_WIDTH + (textWidth.current || 1000);
            const duration = totalDistance * 20;

            scrollX.setValue(SCREEN_WIDTH);
            
            Animated.timing(scrollX, {
                toValue: -(textWidth.current || 1000),
                duration: duration,
                easing: Easing.linear,
                useNativeDriver: true,
                isInteraction: false
            }).start(({ finished }) => {
                if (finished && !isCancelled) startAnimation();
            });
        };

        // Delay to allow layout measurement
        const timer = setTimeout(startAnimation, 800);
        return () => {
            isCancelled = true;
            clearTimeout(timer);
            scrollX.stopAnimation();
        };
    }, [message]);

    const renderMessage = (text) => {
        const parts = text.split(/(\[.+?\]\(.+?\))/g);
        return (
            <View 
                style={styles.textContainer}
                onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    // Only update if we get a real measurement
                    if (w > 10) textWidth.current = w;
                }}
            >
                {parts.map((part, index) => {
                    const match = part.match(/\[(.+?)\]\((.+?)\)/);
                    if (match) {
                        return (
                            <TouchableOpacity 
                                key={index} 
                                activeOpacity={0.6}
                                onPress={() => {
                                    const url = match[2].trim();
                                    console.log('[ANN] Opening URL:', url);
                                    Linking.openURL(url).catch(err => console.error("URL Error", err));
                                }}
                                style={styles.linkWrapper}
                            >
                                <Text style={[styles.link, { color: '#60A5FA' }]}>
                                    {match[1]}
                                </Text>
                            </TouchableOpacity>
                        );
                    }
                    return (
                        <Text key={index} style={[styles.message, { color: colors.text }]}>
                            {part}
                        </Text>
                    );
                })}
                {/* Spacer for loop gap */}
                <View style={{ width: 150 }} />
            </View>
        );
    };

    return (
        <View style={[styles.container, { 
            backgroundColor: isDarkMode ? 'rgba(10,10,10,0.8)' : '#F0F7FF', 
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
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },
    iconContainer: {
        width: 42,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20, // Always on top
        borderEndWidth: 1,
        borderEndColor: 'rgba(255,255,255,0.1)',
    },
    icon: {
        fontSize: 14,
    },
    tickerOuter: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
    },
    tickerWrapper: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        // Forced infinite width to prevent any wrapping
        width: 20000, 
    },
    textContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    message: {
        fontSize: 13,
        fontWeight: '700',
    },
    linkWrapper: {
        paddingHorizontal: 2,
        justifyContent: 'center',
    },
    link: {
        fontSize: 13,
        textDecorationLine: 'underline',
        fontWeight: '900',
    }
});

export default AnnouncementBanner;
