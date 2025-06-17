import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';

const BallTrailOverlay = ({ ballTrail, videoWidth, videoHeight, overlayWidth, overlayHeight }) => {
  if (!ballTrail || ballTrail.length === 0) return null;

  // Calculate scaling factors
  const scaleX = overlayWidth / videoWidth;
  const scaleY = overlayHeight / videoHeight;

  // Create trail points with fade effect
  const createTrailPoints = () => {
    const points = [];
    const trailLength = ballTrail.length;
    
    for (let i = 0; i < trailLength; i++) {
      const detection = ballTrail[i];
      const age = trailLength - i;
      const opacity = Math.max(0.1, 1 - (age / trailLength));
      const radius = Math.max(2, 8 * opacity);
      
      // Scale coordinates to overlay dimensions
      const x = detection.centerX * scaleX;
      const y = detection.centerY * scaleY;
      
      points.push({
        x,
        y,
        opacity,
        radius,
        color: getTrailColor(opacity),
        id: detection.id,
      });
    }
    
    return points;
  };

  // Create trail lines connecting the points
  const createTrailLines = (points) => {
    const lines = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      lines.push({
        x1: current.x,
        y1: current.y,
        x2: next.x,
        y2: next.y,
        opacity: Math.min(current.opacity, next.opacity),
        strokeWidth: Math.max(1, current.radius / 2),
        color: current.color,
        id: `line_${i}`,
      });
    }
    
    return lines;
  };

  const getTrailColor = (opacity) => {
    // Gradient from bright yellow (recent) to blue (older)
    const r = Math.floor(255 * opacity + 0 * (1 - opacity));
    const g = Math.floor(255 * opacity + 150 * (1 - opacity));
    const b = Math.floor(0 * opacity + 255 * (1 - opacity));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const trailPoints = createTrailPoints();
  const trailLines = createTrailLines(trailPoints);

  return (
    <View style={[styles.overlay, { width: overlayWidth, height: overlayHeight }]}>
      <Svg width={overlayWidth} height={overlayHeight} style={styles.svg}>
        <G>
          {/* Draw trail lines first (background) */}
          {trailLines.map((line) => (
            <Line
              key={line.id}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              strokeOpacity={line.opacity}
              strokeLinecap="round"
            />
          ))}
          
          {/* Draw trail points (foreground) */}
          {trailPoints.map((point) => (
            <Circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={point.radius}
              fill={point.color}
              fillOpacity={point.opacity}
              stroke="#FFFFFF"
              strokeWidth={0.5}
              strokeOpacity={point.opacity * 0.8}
            />
          ))}
          
          {/* Highlight the most recent detection */}
          {trailPoints.length > 0 && (
            <Circle
              cx={trailPoints[trailPoints.length - 1].x}
              cy={trailPoints[trailPoints.length - 1].y}
              r={trailPoints[trailPoints.length - 1].radius + 2}
              fill="none"
              stroke="#FF0000"
              strokeWidth={2}
              strokeOpacity={0.8}
            />
          )}
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
    pointerEvents: 'none', // Allow touches to pass through
  },
  svg: {
    position: 'absolute',
  },
});

export default BallTrailOverlay;