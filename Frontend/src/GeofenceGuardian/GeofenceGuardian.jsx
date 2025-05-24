import { useEffect, useState, useRef } from 'react';
import { MapPin, Shield, AlertTriangle, Settings } from 'lucide-react';
import NavBack from "../NavBack";

// Enhanced SOS Button component with auto-trigger functionality
const SosButton = ({ autoTrigger = false, user, apiUrl = 'http://localhost:5000/api' }) => {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [battery, setBattery] = useState(null);
  const [location, setLocation] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Get battery level if available
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBattery(Math.round(battery.level * 100));
      });
    }
  }, []);

  // Auto-trigger SOS countdown when autoTrigger prop changes to true
  useEffect(() => {
    if (autoTrigger && countdown === null && !sending && status?.type !== 'success') {
      console.log('Auto-triggering SOS due to geofence breach');
      startSosCountdown();
    }
  }, [autoTrigger, countdown, sending, status]);

  // Clear status message after 8 seconds
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        setStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Handle countdown timer
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Send SOS when countdown reaches 0
      sendSos();
    }
  }, [countdown]);

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(locationData);
          resolve(locationData);
        },
        error => {
          console.error("Error getting location:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const startSosCountdown = async () => {
    // Get location first
    await getLocation();

    // Start a 10-second countdown for auto-triggered SOS, 5 seconds for manual
    setCountdown(autoTrigger ? 10 : 5);
    setExpanded(true);
  };

  const cancelSos = () => {
    setCountdown(null);
    setExpanded(false);
    setStatus({ type: 'info', message: 'SOS canceled' });
  };

  const sendSos = async () => {
    setSending(true);

    try {
      // If location wasn't already fetched, try again
      const locationData = location || await getLocation();

      // Use real API call instead of mock
      const response = await fetch(`${apiUrl}/sos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.user_id,
          name: user?.name || "Anonymous User",
          location: locationData,
          battery: battery
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus({
          type: 'success',
          message: 'SOS alert sent successfully! Emergency contacts have been notified.',
          details: data
        });
      } else {
        throw new Error(data.message || 'Failed to send SOS');
      }
    } catch (error) {
      console.error('SOS error:', error);
      setStatus({
        type: 'error',
        message: `SOS alert failed: ${error.message}`,
      });
    } finally {
      setSending(false);
      setCountdown(null);
      setExpanded(false);
    }
  };

  return (
    <div className={`sos-container ${expanded ? 'expanded' : ''} max-w-md mx-auto`}>
      {autoTrigger && (
        <div className="mb-4 p-3 bg-red-800/60 border border-red-700 rounded-lg text-red-100 text-center font-semibold">
          <AlertTriangle size={20} className="inline mr-2 text-red-400" />
          <strong>Automatic SOS Triggered - Geofence Breach Detected</strong>
        </div>
      )}

      {countdown !== null ? (
        <div className="countdown-container text-center p-6 bg-purple-900/40 backdrop-blur-md rounded-xl border-2 border-red-700 shadow-xl text-white">
          <div className="countdown-timer mb-4">
            <div className="text-6xl font-extrabold text-red-400 mb-2 animate-pulse">
              {countdown}
            </div>
            <div className="text-lg text-purple-200 mb-4">
              {autoTrigger ? 'Auto-sending SOS alert in' : 'Sending SOS in'} {countdown} seconds
            </div>
            <div className="text-sm text-purple-300 mb-4">
              {location ? '✓ Location acquired' : '⚠ Getting location...'}
              {battery && ` • Battery: ${battery}%`}
            </div>
          </div>
          <button
            className="cancel-button bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform active:scale-95"
            onClick={cancelSos}
          >
            Cancel SOS
          </button>
        </div>
      ) : (
        <>
          {!autoTrigger && (
            <button
              className={`w-full bg-red-600 hover:bg-red-700 text-white px-8 py-4 text-xl font-bold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 ${sending ? 'animate-pulse opacity-75' : 'animate-pulse'}`}
              onClick={startSosCountdown}
              disabled={sending}
              aria-label="Send emergency alert"
            >
              {sending ? '⏳ Sending...' : '🆘 EMERGENCY SOS'}
            </button>
          )}

          {status && (
            <div className={`mt-4 p-4 rounded-lg text-center font-semibold ${
              status.type === 'success' ? 'bg-green-700/60 border border-green-600 text-white' :
              status.type === 'error' ? 'bg-red-800/60 border border-red-700 text-white' :
              'bg-blue-800/60 border border-blue-700 text-white'
            }`}>
              <div className="font-bold mb-2">
                {status.type === 'success' ? '✅' : status.type === 'error' ? '❌' : 'ℹ️'}
                {status.message}
              </div>
              {status.details && (
                <div className="text-sm opacity-80 text-purple-100">
                  Time: {new Date(status.details.timestamp).toLocaleTimeString()}
                  {status.details.location && (
                    <div>Location: {status.details.location.latitude.toFixed(5)}, {status.details.location.longitude.toFixed(5)}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {expanded && countdown === null && !autoTrigger && (
        <div className="mt-4 p-4 bg-purple-900/40 backdrop-blur-md rounded-lg text-center text-sm text-purple-200 border border-purple-700">
          <div className="grid grid-cols-2 gap-4">
            <div>
              {location ? (
                <span className="text-green-400">✓ Location available</span>
              ) : (
                <span className="text-red-400">✗ Location unavailable</span>
              )}
            </div>
            {battery !== null && (
              <div>
                Battery: {battery}%
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Map Component
const GeofenceMap = ({ center, radius, currentLocation, isOutside }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !center) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background (darker to fit the theme)
    ctx.fillStyle = '#1e0c3a'; // Dark purple background
    ctx.fillRect(0, 0, width, height);

    // Calculate scale (roughly 1 pixel per meter for visualization)
    const scale = Math.min(width, height) / (radius * 3);
    const centerX = width / 2;
    const centerY = height / 2;

    // Draw geofence circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * scale, 0, 2 * Math.PI);
    ctx.fillStyle = isOutside ? 'rgba(239, 68, 68, 0.15)' : 'rgba(129, 140, 248, 0.15)'; // Red for outside, light purple for inside
    ctx.fill();
    ctx.strokeStyle = isOutside ? '#ef4444' : '#818cf8'; // Red for outside, vibrant purple for inside
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw center point
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#a78bfa'; // Lighter purple for center
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw current location if available
    if (currentLocation && center) {
      const distance = getDistance(
        center.latitude, center.longitude,
        currentLocation.latitude, currentLocation.longitude
      );

      // Simple projection (not accurate for large distances, but fine for this demo)
      const deltaLat = (currentLocation.latitude - center.latitude) * 111320; // rough meters per degree
      const deltaLon = (currentLocation.longitude - center.longitude) * 111320 * Math.cos(center.latitude * Math.PI / 180);

      const currentX = centerX + (deltaLon * scale);
      const currentY = centerY - (deltaLat * scale); // Y is inverted in canvas

      // Draw current position
      ctx.beginPath();
      ctx.arc(currentX, currentY, 10, 0, 2 * Math.PI);
      ctx.fillStyle = isOutside ? '#ef4444' : '#818cf8'; // Red for outside, light purple for inside
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw distance line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(currentX, currentY);
      ctx.strokeStyle = isOutside ? '#ef4444' : '#c4b5fd'; // Red for outside, even lighter purple for inside
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Add labels
    ctx.fillStyle = '#e0c9ff'; // Light purple text for labels
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Geofence Center', centerX, height - 20);

  }, [center, radius, currentLocation, isOutside]);

  // Haversine formula for distance in meters
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = x => x * Math.PI / 180;
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <div className="border-2 border-purple-700 rounded-lg p-4 bg-purple-950/20 shadow-inner">
      <canvas
        ref={canvasRef}
        width="400"
        height="300"
        className="w-full h-auto border border-purple-700 rounded"
      />
      <div className="mt-2 text-sm text-purple-200 text-center">
        <div className="flex justify-center items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-a78bfa rounded-full"></div>
            <span>Center</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 ${isOutside ? 'bg-red-500' : 'bg-green-500'} rounded-full`}></div>
            <span>Current Position</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Geofencing Component
const GeofenceGuardian = () => {
  // Add new state variables
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [trackingStatus, setTrackingStatus] = useState('inactive');

  const [location, setLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [tempRadius, setTempRadius] = useState(100); // temporary radius for setting
  const [confirmedRadius, setConfirmedRadius] = useState(null); // confirmed radius
  const [isOutsideGeofence, setIsOutsideGeofence] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [isGeofenceActive, setIsGeofenceActive] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [breachDetected, setBreachDetected] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [lastDistance, setLastDistance] = useState(0);

  // Mock user for demo - in real app this would come from props or context
  const mockUser = {
    user_id: 'demo_user_123',
    name: 'Demo User'
  };

  // Add tracking status display helper
  const getTrackingStatusDisplay = () => {
    switch (trackingStatus) {
      case 'getting_location':
        return { color: 'text-yellow-400', text: 'Getting Location...' };
      case 'location_set':
        return { color: 'text-blue-400', text: 'Location Set' };
      case 'geofence_activating':
        return { color: 'text-yellow-400', text: 'Activating...' };
      case 'tracking_active':
        return { color: 'text-green-400', text: 'Tracking Active' };
      case 'tracking_error':
        return { color: 'text-red-400', text: 'Tracking Error' };
      case 'error':
        return { color: 'text-red-400', text: 'Error' };
      default:
        return { color: 'text-gray-400', text: 'Inactive' };
    }
  };

  const statusDisplay = getTrackingStatusDisplay();

  // Update handleGetLocation function
  const handleGetLocation = () => {
    setLocationError(null);
    setTrackingStatus('getting_location');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      setTrackingStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocation({ latitude, longitude });
        setCurrentLocation({ latitude, longitude });
        setOrigin({ latitude, longitude });
        setLocationAccuracy(accuracy);
        setIsOutsideGeofence(false);
        setIsGeofenceActive(false);
        setSosTriggered(false);
        setBreachDetected(false);
        setLastDistance(0);

        // Clear any existing watch
        if (watchId) {
          navigator.geolocation.clearWatch(watchId);
          setWatchId(null);
        }

        setTrackingStatus('location_set');
      },
      (error) => {
        setTrackingStatus('error');
        setLocationError(`Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleSetPerimeter = () => {
    if (!origin) {
      alert('Please set your location first!');
      return;
    }

    setConfirmedRadius(tempRadius);
    setIsGeofenceActive(true);
    setIsOutsideGeofence(false);
    setSosTriggered(false);
    setBreachDetected(false);
    setLastDistance(0);
    setTrackingStatus('geofence_activating');

    console.log(`Geofence activated with ${tempRadius}m radius at`, origin);
  };

  // Haversine formula for distance in meters
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = x => x * Math.PI / 180;
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Watch position changes with improved tracking
  useEffect(() => {
    if (!origin || !isGeofenceActive || confirmedRadius === null) {
      // Clear watch if conditions aren't met
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      return;
    }

    console.log('Starting location tracking...');
    setTrackingStatus('tracking_active');

    const newWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newLocation = { latitude, longitude };
        setCurrentLocation(newLocation);

        const distance = getDistance(origin.latitude, origin.longitude, latitude, longitude);
        setLastDistance(distance);
        const isOutside = distance > confirmedRadius;

        console.log(`Distance from center: ${distance.toFixed(2)}m, Radius: ${confirmedRadius}m, Outside: ${isOutside}, Accuracy: ${accuracy}m`);

        setIsOutsideGeofence(isOutside);

        // Trigger SOS automatically when device leaves geofence (only once per breach)
        if (isOutside && !breachDetected) {
          console.log('GEOFENCE BREACH DETECTED! Triggering SOS...');
          setBreachDetected(true);
          setSosTriggered(true);
        } else if (!isOutside && breachDetected) {
          // Reset breach detection when back inside (with small buffer to prevent oscillation)
          if (distance < confirmedRadius * 0.9) {
            console.log('Back inside geofence, resetting breach detection');
            setBreachDetected(false);
            setSosTriggered(false);
          }
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
        setTrackingStatus('tracking_error');
        setLocationError(`Tracking error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000 // Accept cached location up to 5 seconds old
      }
    );

    setWatchId(newWatchId);

    // Cleanup function
    return () => {
      if (newWatchId) {
        console.log('Clearing location watch');
        navigator.geolocation.clearWatch(newWatchId);
      }
    };
  }, [origin, confirmedRadius, isGeofenceActive, breachDetected]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 font-sans text-white">
      <NavBack className="mb-6" /> {/* Add margin-bottom to NavBack */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold mb-2 flex items-center justify-center gap-3 text-white">
            <Shield className="text-purple-400" size={40} />
            Geofence Guardian
          </h1>
          <p className="text-purple-200 text-lg">Set your safety perimeter and stay protected</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Control Panel */}
          <div className="bg-purple-900/40 backdrop-blur-md rounded-xl shadow-xl p-6 border border-purple-700">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
              <Settings className="text-purple-400" size={24} />
              Control Panel
            </h2>

            {locationError && (
              <div className="bg-red-800/60 border border-red-700 text-white px-4 py-3 rounded-lg mb-4 text-sm font-semibold">
                {locationError}
              </div>
            )}

            <button
              onClick={handleGetLocation}
              className="w-full bg-purple-600 text-white px-6 py-4 text-lg rounded-xl hover:bg-purple-700 transition-all duration-300 transform active:scale-95 shadow-lg mb-6 flex items-center justify-center gap-2 font-semibold"
            >
              <MapPin size={20} />
              Set Current Location
            </button>

            {location && (
              <>
                <div className="bg-purple-800/60 rounded-lg p-4 mb-6 border border-purple-700">
                  <h3 className="font-bold mb-2 text-purple-200">📍 Location Set</h3>
                  <p className="text-sm text-purple-100">
                    Lat: {location.latitude.toFixed(6)}<br/>
                    Lng: {location.longitude.toFixed(6)}
                  </p>
                  {isGeofenceActive && currentLocation && (
                    <p className="text-sm text-purple-300 mt-2">
                      Distance from center: {lastDistance.toFixed(1)}m
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-center mb-3 font-semibold text-white">
                    Safety Perimeter: {tempRadius} meters
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2000"
                    step="0.1"
                    value={tempRadius}
                    onChange={e => setTempRadius(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #a78bfa 0%, #a78bfa ${((tempRadius-0.1)/(2000-0.1))*100}%, #6b21a8 ${((tempRadius-0.1)/(2000-0.1))*100}%, #6b21a8 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-purple-300 mt-1">
                    <span>0.1m</span>
                    <span>1000m</span>
                    <span>2000m</span>
                  </div>
                </div>

                <button
                  onClick={handleSetPerimeter}
                  className="w-full bg-green-600 text-white px-6 py-4 text-lg rounded-xl hover:bg-green-700 transition-all duration-300 transform active:scale-95 shadow-lg mb-4 font-semibold"
                >
                  🛡️ Activate Geofence Protection
                </button>

                {isGeofenceActive && (
                  <div className="bg-green-700/60 border border-green-600 text-white px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield size={20} className="text-green-300" />
                      <span className="font-bold">
                        Geofence Active - {confirmedRadius}m radius
                      </span>
                    </div>
                    <div className="text-sm mt-1 text-green-200">
                      Real-time tracking: {watchId ? 'ON' : 'OFF'}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Visual Map */}
          <div className="bg-purple-900/40 backdrop-blur-md rounded-xl shadow-xl p-6 border border-purple-700">
            <h2 className="text-2xl font-bold mb-6 text-white">Visual Map</h2>

            {location ? (
              <GeofenceMap
                center={origin}
                radius={isGeofenceActive ? confirmedRadius : tempRadius}
                currentLocation={currentLocation}
                isOutside={isOutsideGeofence}
              />
            ) : (
              <div className="border-2 border-dashed border-purple-700 rounded-lg p-8 text-center text-purple-300">
                <MapPin size={48} className="mx-auto mb-4 text-purple-500" />
                <p>Set your location to see the visual map</p>
              </div>
            )}
          </div>
        </div>

        {/* Alert Section */}
        {isOutsideGeofence && (
          <div className="mt-8 bg-red-800/60 border-2 border-red-700 rounded-xl p-6 text-center shadow-xl">
            <div className="flex items-center justify-center gap-3 mb-4">
              <AlertTriangle className="text-red-400" size={32} />
              <h3 className="text-2xl font-bold text-red-300">GEOFENCE BREACH DETECTED!</h3>
            </div>
            <p className="text-red-100 mb-6 text-lg">
              You have moved outside your designated safe area ({lastDistance.toFixed(1)}m from center). Emergency protocol activated.
            </p>
            <SosButton
              autoTrigger={sosTriggered}
              user={mockUser}
              apiUrl="http://localhost:5000/api"
            />
          </div>
        )}

        {/* Status Bar */}
        <div className="mt-8 bg-purple-900/40 backdrop-blur-md rounded-xl shadow-xl p-4 border border-purple-700">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${location ? 'bg-green-400' : 'bg-gray-500'}`}></div>
              <span>Location {location ? 'Set' : 'Not Set'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isGeofenceActive ? 'bg-green-400' : 'bg-gray-500'}`}></div>
              <span>Geofence {isGeofenceActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${watchId ? 'bg-green-400' : 'bg-gray-500'}`}></div>
              <span className={statusDisplay.color}>{statusDisplay.text}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${locationAccuracy && locationAccuracy < 20 ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span>Accuracy: {locationAccuracy ? `±${locationAccuracy.toFixed(1)}m` : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isOutsideGeofence ? 'bg-red-400' : 'bg-green-400'}`}></div>
              <span>{isOutsideGeofence ? 'Outside' : 'Inside'} Perimeter</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeofenceGuardian;