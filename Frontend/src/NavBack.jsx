import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from 'react-feather';

function NavBack({ user, title }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear session/local storage if used
    localStorage.removeItem("user");
    sessionStorage.clear();
    
    // Redirect to login
    navigate("/login");
  };

  const handleBack = () => {
    // Navigate to dashboard
    navigate("/dashboard");
  };

  // Framer Motion variants for the navbar elements
  const navbarVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 }
  };

  // Framer Motion variants for the glowing brain
  const brainGlowVariants = {
    initial: { textShadow: "0 0px 0px rgba(255,255,255,0.7)" },
    animate: {
      textShadow: ["0 0 0px rgba(255,255,255,0.7)", "0 0 8px rgba(255,255,255,0.7)", "0 0 0px rgba(255,255,255,0.7)"],
      transition: {
        duration: 2,
        repeat: Infinity, // Repeat the glow animation indefinitely
        repeatType: "mirror", // Make it pulse in and out smoothly
        ease: "easeInOut"
      }
    }
  };


  return (
    <motion.div
      className="flex justify-between items-center px-4 py-3 sm:px-6 mb-8 rounded-full bg-purple-700 shadow-xl"
      variants={navbarVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Left section: Back button (if needed) */}
      <motion.div className="flex items-center space-x-3" variants={itemVariants}>
        {/* Only show back button if not on dashboard or specific page */}
        {window.location.pathname !== "/dashboard" && ( 
          <motion.button 
            onClick={handleBack} 
            className="p-2 rounded-full hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-300 transition-colors duration-200"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </motion.div>

      {/* Center section: App Brand (EchoMind) */}
      <motion.div className="flex items-center space-x-2" variants={itemVariants}>
        <motion.span 
          className="text-3xl sm:text-4xl" 
          variants={brainGlowVariants} // Apply glow variants here
          initial="initial"
          animate="animate"
        >
          🧠
        </motion.span>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
          {title || "EchoMind"}
        </h1>
      </motion.div>

      {/* Right section: User greeting and Logout button */}
      <motion.div className="flex items-center space-x-4" variants={itemVariants}>
        {user && (
          <span className="hidden md:block text-sm sm:text-base text-purple-100">
            Welcome, {user.name}
          </span>
        )}
        <motion.button
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-md transition duration-300 focus:outline-none focus:ring-2 focus:ring-red-400"
          onClick={handleLogout}
          whileHover={{ scale: 1.05, boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)" }}
          whileTap={{ scale: 0.95 }}
        >
          Logout
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export default NavBack;