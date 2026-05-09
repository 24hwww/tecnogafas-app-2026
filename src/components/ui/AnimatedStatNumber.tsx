import { motion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

interface AnimatedStatNumberProps {
  value: number;
  previousValue?: number;
  className?: string;
  duration?: number;
}

export function AnimatedStatNumber({
  value,
  previousValue,
  className = '',
  duration = 1000,
}: AnimatedStatNumberProps) {
  // Ensure value is always a number
  const safeValue = value ?? 0;
  const [displayValue, setDisplayValue] = useState(previousValue ?? 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentValueRef = useRef(displayValue);

  // Update ref when displayValue changes
  useEffect(() => {
    currentValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (safeValue !== currentValueRef.current) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsAnimating(true);

      // Countdown animation
      const steps = 20;
      const stepDuration = duration / steps;
      const increment = (safeValue - currentValueRef.current) / steps;
      let currentStep = 0;

      const animate = () => {
        currentStep++;
        const newValue = currentValueRef.current + increment * currentStep;

        if (currentStep >= steps) {
          setDisplayValue(safeValue);
          setIsAnimating(false);
        } else {
          setDisplayValue(Math.round(newValue));
          timeoutRef.current = setTimeout(animate, stepDuration);
        }
      };

      animate();
    }
  }, [safeValue, duration]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <motion.span
        key={displayValue}
        initial={{ scale: 0.8, opacity: 0.5 }}
        animate={{
          scale: isAnimating ? [1, 1.1, 1] : 1,
          opacity: 1,
        }}
        transition={{
          duration: 0.3,
          ease: 'easeOut',
        }}
        className="font-mono font-bold"
      >
        {formatNumber(displayValue)}
      </motion.span>
    </div>
  );
}
