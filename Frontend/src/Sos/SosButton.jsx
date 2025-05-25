import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  BatteryCharging,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
} from "react-feather";
import NavBack from "../NavBack";
import { useTranslation } from "react-i18next"; // Import translation hook

const SosButton = ({ user, apiUrl = "http://localhost:5000/api" }) => {
  const { t } = useTranslation(); // Initialize translation hook
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [battery, setBattery] = useState(null);
  const [location, setLocation] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [expanded, setExpanded] = useState(false); // Used to show/hide details and change container size

  // Get battery level if available
  useEffect(() => {
    if ("getBattery" in navigator) {
      navigator.getBattery().then((battery) => {
        setBattery(Math.round(battery.level * 100));
      });
    }
  }, []);

  // Clear status message after 5 seconds
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
        setStatus({
          type: "warning",
          message: t("geolocationNotSupported"),
        });
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setLocation(locationData);
          resolve(locationData);
        },
        (error) => {
          console.error("Error getting location:", error);
          let errorMessage = t("locationErrorGeneric");
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = t("locationPermissionDenied");
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = t("locationUnavailable");
          } else if (error.code === error.TIMEOUT) {
            errorMessage = t("locationTimeout");
          }
          setStatus({ type: "warning", message: errorMessage });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const startSosCountdown = async () => {
    setSending(true);
    setStatus({ type: "info", message: t("gettingLocation") });
    const locationData = await getLocation();

    // Only proceed with countdown if location is available or user confirms to send without it
    if (
      locationData ||
      confirm(t("locationNotAvailableConfirm"))
    ) {
      setCountdown(5);
      setExpanded(true); // Expand to show countdown and potential details
      setStatus(null); // Clear previous status
    } else {
      setSending(false);
      setStatus({ type: "info", message: t("sosCancelled") });
    }
  };

  const cancelSos = () => {
    setCountdown(null);
    setExpanded(false);
    setSending(false);
    setStatus({ type: "info", message: t("sosAlertCanceled") });
  };

  const sendSos = async () => {
    setSending(true);
    setStatus({ type: "info", message: t("sendingSosAlert") });

    try {
      const locationData = location || (await getLocation());

      const response = await axios.post(`${apiUrl}/sos`, {
        user_id: user?.user_id,
        name: user?.name || t("anonymousUser"),
        location: locationData,
        battery: battery,
      });

      if (response.data.success) {
        setStatus({
          type: "success",
          message: t("sosAlertSentSuccess"),
          details: response.data,
        });
      } else {
        throw new Error(response.data.message || t("failedToSendSos"));
      }
    } catch (error) {
      console.error("SOS error:", error);
      setStatus({
        type: "error",
        message: `${t("sosAlertFailed")}: ${
          error.response?.data?.message || error.message || t("networkError")
        }`,
      });
    } finally {
      setSending(false);
      setCountdown(null);
      setExpanded(false);
    }
  };

  const statusMessageVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const buttonVariants = {
    initial: { scale: 1 },
    tap: { scale: 0.95 },
    hover: { scale: 1.05 },
    glow: {
      boxShadow: [
        "0 0 0px rgba(255,0,0,0)",
        "0 0 20px rgba(255,50,50,0.8)", // Brighter red glow
        "0 0 5px rgba(255,50,50,0.4)", // A slight residual glow
        "0 0 0px rgba(255,0,0,0)",
      ],
      transition: {
        repeat: Infinity,
        duration: 2, // Slower glow
        ease: "easeInOut",
        times: [0, 0.5, 0.8, 1], // Control timing of keyframes
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black pt-2 px-2">
      <NavBack />
      <div className="min-h-screen  text-white flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="w-full max-w-sm bg-gray-800 bg-opacity-80 rounded-xl shadow-2xl p-6 sm:p-8 flex flex-col items-center relative"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-200 tracking-wide uppercase mb-4">
              {t("emergencyAlertSystem")}
            </h1>
          </div>

          <div
            className={`relative w-64 h-64 flex items-center justify-center rounded-full transition-all duration-500 ease-in-out 
          ${
            expanded
              ? "bg-red-900 border-red-700 border-4 shadow-lg"
              : "bg-red-700 shadow-xl"
          }`}
          >
            {countdown !== null ? (
              <motion.div
                className="flex flex-col items-center justify-center text-white p-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="countdown-timer text-6xl sm:text-8xl font-bold">
                  <span className="countdown-number">{countdown}</span>
                </div>
                <span className="countdown-text text-base sm:text-lg mt-2">
                  {t("sendingSosInSeconds", { seconds: countdown })}
                </span>
                <motion.button
                  className="mt-6 px-6 py-3 bg-white text-red-600 rounded-full font-semibold text-lg shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-300"
                  onClick={cancelSos}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t("cancel")}
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                className={`sos-button w-56 h-56 flex flex-col items-center justify-center rounded-full text-white font-bold text-5xl shadow-xl transition-all duration-300 ease-in-out 
                ${
                  sending
                    ? "bg-red-800 animate-pulse"
                    : "bg-red-600 hover:bg-red-700"
                } 
                ${!sending && !status?.type && "relative overflow-hidden"}`}
                onClick={startSosCountdown}
                disabled={sending}
                aria-label={t("sendEmergencyAlert")}
                variants={buttonVariants}
                initial="initial"
                whileTap="tap"
                whileHover="hover"
                animate={!sending && !status?.type ? "glow" : ""}
              >
                <span className="text-5xl">SOS</span>
                <span className="text-lg mt-1">{t("emergency")}</span>
                {sending && (
                  <span className="absolute inset-0 flex items-center justify-center bg-red-800 bg-opacity-70 rounded-full">
                    <svg
                      className="animate-spin h-10 w-10 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </span>
                )}
              </motion.button>
            )}
          </div>

          <AnimatePresence>
            {status && (
              <motion.div
                className={`mt-6 p-3 rounded-lg text-sm text-center w-full max-w-sm 
                ${
                  status.type === "success"
                    ? "bg-green-700 text-white border border-green-500"
                    : status.type === "error"
                    ? "bg-red-700 text-white border border-red-500"
                    : status.type === "warning"
                    ? "bg-yellow-700 text-white border border-yellow-500"
                    : "bg-blue-700 text-white border border-blue-500"
                }`}
                variants={statusMessageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="flex items-center justify-center">
                  {status.type === "success" && (
                    <CheckCircle className="w-5 h-5 mr-2" />
                  )}
                  {status.type === "error" && (
                    <XCircle className="w-5 h-5 mr-2" />
                  )}
                  {status.type === "info" && <Info className="w-5 h-5 mr-2" />}
                  {status.type === "warning" && (
                    <AlertCircle className="w-5 h-5 mr-2" />
                  )}
                  <span>{status.message}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {expanded && countdown === null && (
            <motion.div
              className="sos-details mt-6 text-gray-300 text-base space-y-2 text-center"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div className="location-status flex items-center justify-center">
                {location ? (
                  <span className="flex items-center text-green-400 font-semibold">
                    <MapPin className="w-5 h-5 mr-2" /> {t("locationAvailable")} (
                    {location.latitude.toFixed(4)},{" "}
                    {location.longitude.toFixed(4)})
                  </span>
                ) : (
                  <span className="flex items-center text-red-400 font-semibold">
                    <AlertCircle className="w-5 h-5 mr-2" /> {t("locationUnavailable")}
                  </span>
                )}
              </div>

              {battery !== null && (
                <div className="battery-status flex items-center justify-center">
                  <BatteryCharging className="w-5 h-5 mr-2 text-gray-400" />{" "}
                  {t("battery")}:{" "}
                  <span className="font-semibold ml-1">{battery}%</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {t("locationAccuracyNote")}
              </p>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className="w-full max-w-2xl bg-gray-800 bg-opacity-80 rounded-xl shadow-2xl p-6 sm:p-8 mt-8"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-200 mb-6 text-center">
            {t("howThisHelps")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div
              className="info-card flex flex-col items-center text-center p-4 rounded-lg bg-gray-700 shadow-md"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="info-icon bg-blue-600 p-3 rounded-full mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100 mb-2">
                {t("instantLocationSharing")}
              </h3>
              <p className="text-sm text-gray-300">
                {t("locationSharingDescription")}
              </p>
            </motion.div>
            <motion.div
              className="info-card flex flex-col items-center text-center p-4 rounded-lg bg-gray-700 shadow-md"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
            >
              <div className="info-icon bg-yellow-600 p-3 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100 mb-2">
                {t("quickEmergencyResponse")}
              </h3>
              <p className="text-sm text-gray-300">
                {t("emergencyResponseDescription")}
              </p>
            </motion.div>
            <motion.div
              className="info-card flex flex-col items-center text-center p-4 rounded-lg bg-gray-700 shadow-md"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
            >
              <div className="info-icon bg-green-600 p-3 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100 mb-2">
                {t("enhancedIndependence")}
              </h3>
              <p className="text-sm text-gray-300">
                {t("independenceDescription")}
              </p>
            </motion.div>
          </div>

          <div className="usage-instructions bg-gray-900 p-6 rounded-lg shadow-inner">
            <h3 className="text-xl font-bold text-red-400 mb-4 text-center">
              {t("whenToUse")}
            </h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 mb-6">
              <li>{t("whenLost")}</li>
              <li>{t("medicalEmergencies")}</li>
              <li>{t("needAssistance")}</li>
              <li>{t("feelingUnsafe")}</li>
            </ul>
            <p className="caregiver-note text-red-300 italic text-center text-sm sm:text-base">
              <strong>{t("forCaregivers")}:</strong> {t("caregiverNoteInfo")}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SosButton;
