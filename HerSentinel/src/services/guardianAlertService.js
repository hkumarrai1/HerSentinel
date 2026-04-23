import { Platform, Vibration } from 'react-native';
import SoundPlayer from 'react-native-sound-player';

const ALERT_SIREN_URL =
  'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';
const LOCAL_ANDROID_SIREN_NAME = 'siren_alert';
const LOCAL_ANDROID_SIREN_TYPE = 'wav';
const SIREN_REPEAT_MS = 2800;

let sirenTimer = null;

const playAlertOnce = () => {
  try {
    if (Platform.OS === 'android') {
      try {
        SoundPlayer.playSoundFile(
          LOCAL_ANDROID_SIREN_NAME,
          LOCAL_ANDROID_SIREN_TYPE,
        );
      } catch (localError) {
        SoundPlayer.playUrl(ALERT_SIREN_URL);
      }
    } else {
      SoundPlayer.playUrl(ALERT_SIREN_URL);
    }

    Vibration.vibrate(700);

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Unable to play alert siren',
    };
  }
};

const startAlertSiren = () => {
  if (sirenTimer) {
    return {
      success: true,
      alreadyRunning: true,
    };
  }

  const playResult = playAlertOnce();

  sirenTimer = setInterval(() => {
    playAlertOnce();
  }, SIREN_REPEAT_MS);

  return {
    success: playResult.success,
    alreadyRunning: false,
    message: playResult.message,
  };
};

const stopAlertSiren = () => {
  if (sirenTimer) {
    clearInterval(sirenTimer);
    sirenTimer = null;
  }

  try {
    SoundPlayer.stop();
  } catch (error) {
    // noop
  }

  try {
    Vibration.cancel();
  } catch (error) {
    // noop
  }
};

const playSirenPreview = () => {
  stopAlertSiren();
  return playAlertOnce();
};

const guardianAlertService = {
  startAlertSiren,
  stopAlertSiren,
  playSirenPreview,
};

export default guardianAlertService;
