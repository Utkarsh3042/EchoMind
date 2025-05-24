import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import Navbar from "../Navbar";

// If using npm install for Font Awesome, make sure this is imported somewhere:
// import '@fortawesome/fontawesome-free/css/all.min.css';

function Dashboard({ patients, selectedPatient, loading, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("user"));
  const [isRecording, setIsRecording] = useState(false);

  // --- Animation Variants ---
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 },
    },
  };

  const profileCardVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.7, ease: "easeOut" },
    },
  };

  const sosButtonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: [0.8, 1.1, 1],
      transition: { duration: 0.5, ease: "easeOut", delay: 0.5 },
    },
  };

  const tileVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
    hover: { scale: 1.05, transition: { duration: 0.2 } },
    tap: { scale: 0.95 },
  };

  const recordButtonVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut", delay: 0.8 },
    },
    pulse: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 1.5,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror",
      },
    },
  };

  // --- Utility ---
  const isActive = (path) =>
    location.pathname.includes(path)
      ? "bg-purple-600 text-white shadow-lg"
      : "bg-white/10 text-white";

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleSOS = () => {
    navigate("/sos");
  };

  const toggleRecording = async () => {
    try {
      const endpoint = isRecording
        ? "https://slzvr7mc-5000.inc1.devtunnels.ms/stop"
        : "https://slzvr7mc-5000.inc1.devtunnels.ms/recognize";

      console.log(`Calling endpoint: ${endpoint}`);

      let response;
      if (isRecording) {
        // If currently recording, send POST to stop
        response = await axios.post(endpoint);
      } else {
        // If not recording, send GET to recognize (start)
        response = await axios.get(endpoint);
      }

      if (response.status === 200) {
        // Successfully toggled, update the state
        setIsRecording(!isRecording);
        console.log(`Recording state toggled to: ${!isRecording}`);
      } else {
        console.error(`Unexpected response status: ${response.status}`);
        // If the API call failed, don't change the recording state.
        // Optionally, you could add an alert or some user feedback here
      }
    } catch (error) {
      console.error("Error toggling recording:", error);
      // If there's an error, don't change the recording state.
      // Optionally, you could add an alert or some user feedback here
    }
  };

  // --- Loading Screen ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-700 to-indigo-900">
        <div className="p-4 bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl shadow-xl flex flex-col items-center">
          <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mb-4"></div>
          <p className="text-white text-lg font-semibold">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  // --- Main Component ---
  return (
    <>
      <Navbar user={user} />
      <motion.div
        className="min-h-screen bg-gradient-to-br from-purple-700 to-indigo-900 flex flex-col items-center px-1 text-white"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Greeting + SOS */}
        <motion.div
          className="w-full max-w-2xl bg-green-300 bg-opacity-10 backdrop-blur-md border border-white border-opacity-20 rounded-3xl shadow-2xl p-6 sm:p-8 mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
          variants={profileCardVariants}
        >
          <div>
            <motion.h2
              className="text-4xl text-black font-extrabold mb-1"
              variants={profileCardVariants}
            >
              Hello, {userData?.name || "User"}!
            </motion.h2>
            <motion.p
              className="text-sm text-black"
              variants={profileCardVariants}
            >
              Today is{" "}
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </motion.p>
          </div>

          <motion.div
            className="mt-6 flex justify-center w-full"
            variants={sosButtonVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.button
              onClick={handleSOS}
              className="text-white backdrop-blur-lg border border-white/20 bg-red-800 font-bold py-4 px-10 rounded-full shadow-2xl flex items-center gap-3 text-lg"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <i className="fas fa-exclamation-circle text-2xl" />
              <span>Send SOS</span>
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Dashboard Tiles */}
        <div className="grid grid-cols-2 gap-5 mt-10 w-full max-w-2xl">
          {[
            { icon: "fas fa-chart-line", label: "Summary", path: "/summary" },
            { icon: "fas fa-gamepad", label: "Games", path: "/games" },
            {
              icon: "fas fa-calendar-alt",
              label: "Routine & Medication",
              path: "/medication-reminder",
            },
            {
              icon: "fas fa-address-book",
              label: "Contacts",
              path: "/contacts",
            },{ // Add this new tile
              icon: "fas fa-map-marked-alt", // Choose a relevant icon
              label: "Geo-Fencing",
              path: "/geofence-guardian", // New path for your Geo-Fencing component
            }
          ].map(({ icon, label, path }) => (
            <motion.button
              key={path}
              onClick={() => handleNavigation(path)}
              className={`flex flex-col items-center justify-center text-center bg-white/10 backdrop-blur-lg border border-white/10 hover:border-purple-400 rounded-2xl shadow-xl p-6 sm:p-8 font-semibold text-white hover:bg-white/20 active:bg-white/25 ${isActive(
                path
              )}`}
              variants={tileVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <i className={`${icon} text-4xl  text-black z-10`} />
              <span>{label}</span>
            </motion.button>
          ))}
        </div>

        {/* Record Button */}
        <motion.button
          className="mt-10 px-10 py-5 rounded-full text-white font-bold text-2xl shadow-xl bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 transition-all flex items-center gap-3"
          onClick={toggleRecording}
          variants={recordButtonVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isRecording ? (
            <motion.span
              className="flex items-center gap-2 text-red-800"
              animate="pulse"
              variants={recordButtonVariants}
            >
              <i className="fas fa-stop-circle text-3xl" /> Stop Recording
            </motion.span>
          ) : (
            <span className="flex items-center gap-2 text-white">
              <i className="fas fa-play-circle text-3xl" /> Start Recording
            </span>
          )}
        </motion.button>
      </motion.div>
    </>
  );
}

export default Dashboard;