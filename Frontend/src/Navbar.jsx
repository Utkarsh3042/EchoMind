import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next"; // Import translation hook

function Navbar({ user }) {
  const navigate = useNavigate();
  const { t } = useTranslation(); // Initialize translation hook

  const navbarVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: "easeOut",
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

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

  const brandVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const logoutButtonVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    sessionStorage.clear();
    navigate("/login");
  };

  return (
    <motion.div
      className="
     bg-gradient-to-br from-purple-700 to-indigo-900
    text-white
    flex justify-between items-center
    shadow-xl
    sticky top-0 z-50
    min-h-[70px]
      "
      variants={navbarVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="justify-self-start"></div>

      <motion.div
        className="
          flex items-center gap-4
          justify-self-center
          col-start-2 col-end-3
        "
        variants={brandVariants}
      >
        <motion.span 
          className="text-3xl sm:text-4xl" 
          variants={brainGlowVariants} // Apply glow variants here
          initial="initial"
          animate="animate"
        >🧠</motion.span>
        <h1
          className="
            m-0 text-3xl sm:text-4xl md:text-5xl lg:text-4xl font-extrabold tracking-wide
            text-white
            drop-shadow-lg
          "
        >
          EchoMind
        </h1>
      </motion.div>

      <div
        className="
          flex flex-wrap items-center gap-6
          justify-self-end
          col-start-3 col-end-4
          sm:gap-4 lg:gap-6
        "
      >
        {user && (
          <span className="font-semibold whitespace-nowrap text-lg sm:text-xl text-gray-100 drop-shadow-sm">
            {t('hi')}, {user.name}
          </span>
        )}
        <motion.button
          className="
            bg-white/20 text-white
            py-1 mr-2 px-3 
            border-2 border-white/30
            font-bold rounded-xl
            cursor-pointer
            transition-all duration-300 ease-in-out
            text-base sm:text-sm lg:text-base
            shadow-md
          "
          onClick={handleLogout}
          variants={logoutButtonVariants}
          whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0,0,0,0.25)" }}
          whileTap={{ scale: 0.95 }}
        >
          {t('logout')}
        </motion.button>
      </div>
    </motion.div>
  );
}

export default Navbar;