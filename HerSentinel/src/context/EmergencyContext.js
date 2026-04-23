import React, { createContext, useState, useCallback } from 'react';

export const EmergencyContext = createContext();

export const EmergencyProvider = ({ children }) => {
  const [isEmergencyModeOn, setIsEmergencyModeOn] = useState(false);
  const [activeEventId, setActiveEventId] = useState(null);

  const toggleEmergencyMode = useCallback(enabled => {
    console.log(`Emergency Mode: ${enabled ? 'ON 🔴' : 'OFF ⚪'}`);
    setIsEmergencyModeOn(enabled);
  }, []);

  const setActiveEvent = useCallback(eventId => {
    setActiveEventId(eventId);
  }, []);

  return (
    <EmergencyContext.Provider
      value={{
        isEmergencyModeOn,
        activeEventId,
        toggleEmergencyMode,
        setActiveEvent,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
};

export default EmergencyContext;
