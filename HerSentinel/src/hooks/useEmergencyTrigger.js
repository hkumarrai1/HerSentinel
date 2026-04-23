// Emergency Trigger Service
// Detects: Phone shake (4-5 times) OR voice command ("help" 4-5 times)
// Works in background when Emergency Mode is ON

import { useEffect, useRef, useCallback } from 'react';
import { accelerometer } from 'react-native-sensors';
import Voice from '@react-native-voice/voice';

const SHAKE_THRESHOLD = 50; // Acceleration threshold to detect shake
const SHAKE_COUNT_REQUIRED = 4; // Number of shakes needed to trigger SOS
const SHAKE_RESET_TIME = 2000; // Reset counter after 2 seconds of no shake
const VOICE_TRIGGER_WORD = 'help'; // Word to listen for
const VOICE_TRIGGER_COUNT = 4; // Number of times to say "help"
const VOICE_TRIGGER_TIMEOUT = 5000; // Listen for 5 seconds

export const useEmergencyTrigger = (
  onEmergencyTriggered,
  isEmergencyModeOn,
) => {
  const shakeCountRef = useRef(0);
  const shakeResetTimerRef = useRef(null);
  const shakeSubscriptionRef = useRef(null);
  const voiceCountRef = useRef(0);
  const voiceResetTimerRef = useRef(null);
  const isListeningRef = useRef(false);

  // ============================================
  // SHAKE DETECTION LOGIC
  // ============================================

  const handleShakeDetected = useCallback(() => {
    shakeCountRef.current += 1;
    console.log(
      `Shake detected: ${shakeCountRef.current}/${SHAKE_COUNT_REQUIRED}`,
    );

    // Clear existing reset timer
    if (shakeResetTimerRef.current) {
      clearTimeout(shakeResetTimerRef.current);
    }

    // Check if threshold reached
    if (shakeCountRef.current >= SHAKE_COUNT_REQUIRED) {
      console.log('🚨 EMERGENCY TRIGGERED BY SHAKE!');
      shakeCountRef.current = 0; // Reset counter

      if (onEmergencyTriggered) {
        onEmergencyTriggered('SHAKE_DETECTION');
      }
    } else {
      // Reset counter after inactivity
      shakeResetTimerRef.current = setTimeout(() => {
        console.log('Shake counter reset (no shake for 2 seconds)');
        shakeCountRef.current = 0;
      }, SHAKE_RESET_TIME);
    }
  }, [onEmergencyTriggered]);

  // Start shake detection
  const startShakeDetection = useCallback(() => {
    try {
      let lastShakeTime = 0;

      shakeSubscriptionRef.current = accelerometer.subscribe(({ x, y, z }) => {
        const acceleration = Math.sqrt(x * x + y * y + z * z);

        // Detect significant acceleration change (shake)
        if (acceleration > SHAKE_THRESHOLD) {
          const currentTime = Date.now();

          // Avoid registering same shake multiple times
          if (currentTime - lastShakeTime > 500) {
            handleShakeDetected();
            lastShakeTime = currentTime;
          }
        }
      });

      console.log('✅ Shake detection started');
    } catch (error) {
      console.log('Shake detection unavailable:', error);
    }
  }, [handleShakeDetected]);

  // Stop shake detection
  const stopShakeDetection = useCallback(() => {
    if (shakeSubscriptionRef.current) {
      shakeSubscriptionRef.current.unsubscribe();
      shakeSubscriptionRef.current = null;
    }

    if (shakeResetTimerRef.current) {
      clearTimeout(shakeResetTimerRef.current);
      shakeResetTimerRef.current = null;
    }

    shakeCountRef.current = 0;
    console.log('✅ Shake detection stopped');
  }, []);

  // ============================================
  // VOICE RECOGNITION LOGIC
  // ============================================

  const stopVoiceDetection = useCallback(async () => {
    try {
      await Voice.stop();
      isListeningRef.current = false;
      console.log('✅ Voice detection stopped');
    } catch (error) {
      console.log('Error stopping voice:', error);
    }
  }, []);

  useEffect(() => {
    Voice.onSpeechStart = () => {
      console.log('Voice listening started...');
    };

    Voice.onSpeechRecognized = () => {
      console.log('Voice recognized');
    };

    Voice.onSpeechEnd = () => {
      console.log('Voice listening ended');
    };

    Voice.onSpeechError = error => {
      console.log('Voice error:', error);
    };

    Voice.onSpeechResults = results => {
      if (results && results.length > 0) {
        const recognizedText = results[0].toLowerCase();
        console.log('Recognized:', recognizedText);

        // Check if recognized text contains trigger word
        if (recognizedText.includes(VOICE_TRIGGER_WORD)) {
          voiceCountRef.current += 1;
          console.log(
            `Voice trigger detected: ${voiceCountRef.current}/${VOICE_TRIGGER_COUNT}`,
          );

          // Reset timer on each successful recognition
          if (voiceResetTimerRef.current) {
            clearTimeout(voiceResetTimerRef.current);
          }

          // Check if threshold reached
          if (voiceCountRef.current >= VOICE_TRIGGER_COUNT) {
            console.log('🚨 EMERGENCY TRIGGERED BY VOICE!');
            voiceCountRef.current = 0;

            if (onEmergencyTriggered) {
              onEmergencyTriggered('VOICE_DETECTION');
            }

            // Stop listening after trigger
            stopVoiceDetection();
          } else {
            // Reset counter after timeout
            voiceResetTimerRef.current = setTimeout(() => {
              console.log(
                'Voice trigger counter reset (timeout without hearing "help")',
              );
              voiceCountRef.current = 0;
            }, VOICE_TRIGGER_TIMEOUT);
          }
        }
      }
    };

    Voice.onSpeechPartialResults = results => {
      // Partial results (real-time feedback)
      if (results && results.length > 0) {
        console.log('Partial voice input:', results[0]);
      }
    };

    return () => {
      Voice.destroy().catch(() => {});
    };
  }, [onEmergencyTriggered, stopVoiceDetection]);

  const startVoiceDetection = useCallback(async () => {
    if (isListeningRef.current) {
      return; // Already listening
    }

    try {
      isListeningRef.current = true;
      voiceCountRef.current = 0;

      // Request permissions if needed
      await Voice.start('en-US');
      console.log('✅ Voice detection started');

      // Set timeout to stop listening after duration
      setTimeout(() => {
        stopVoiceDetection();
      }, 30000); // Listen for 30 seconds max
    } catch (error) {
      console.log('Voice detection error:', error);
      isListeningRef.current = false;
    }
  }, [stopVoiceDetection]);

  // ============================================
  // LIFECYCLE - START/STOP BASED ON EMERGENCY MODE
  // ============================================

  useEffect(() => {
    if (isEmergencyModeOn) {
      console.log('🔴 EMERGENCY MODE ON - Starting detectors...');
      startShakeDetection();
      startVoiceDetection();
    } else {
      console.log('🟢 EMERGENCY MODE OFF - Stopping detectors...');
      stopShakeDetection();
      stopVoiceDetection();
    }

    return () => {
      stopShakeDetection();
      stopVoiceDetection();
    };
  }, [
    isEmergencyModeOn,
    startShakeDetection,
    stopShakeDetection,
    startVoiceDetection,
    stopVoiceDetection,
  ]);

  return {
    shakeCount: shakeCountRef.current,
    voiceCount: voiceCountRef.current,
    isListening: isListeningRef.current,
  };
};

export default useEmergencyTrigger;
