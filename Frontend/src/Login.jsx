import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; 
const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- Framer Motion Variants ---

  // Main card fade-in and subtle scale
  const formCardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut",
        when: "beforeChildren", // Ensures parent animates before its children
        staggerChildren: 0.1 // Staggers the animation of direct children
      }
    }
  };

  // Brain container (initial scale and opacity)
  const brainContainerVariants = {
    hidden: { scale: 0.75, opacity: 0 },
    visible: {
      scale: 1.25, // Zooms in
      opacity: 1,
      transition: {
        duration: 1.2,
        ease: "easeOut",
        delay: 0.3 // Starts animating slightly after the form card
      }
    }
  };

  // Brain emoji pulsing glow effect
  const brainEmojiVariants = {
    pulse: {
      filter: [
        'drop-shadow(0 0 5px rgba(255, 255, 255, 0.4))', // Soft glow
        'drop-shadow(0 0 15px rgba(255, 255, 255, 0.8))', // Brighter glow
        'drop-shadow(0 0 5px rgba(255, 255, 255, 0.4))'
      ],
      transition: {
        duration: 2,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror" // Repeats the animation back and forth
      }
    }
  };

  // Blue glow animation behind the brain
  const brainGlowVariants = {
    glow: {
      opacity: [0, 0.4, 0],
      transition: {
        duration: 1.5,
        ease: "easeOut",
        repeat: Infinity,
        repeatDelay: 1 // Delay before repeating
      }
    }
  };

  // Input field slide-in effect
  const inputVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  // Button initial bounce effect
  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: [0, -10, -5, 0], // Keyframes for a subtle bounce
      transition: {
        duration: 0.8,
        ease: "easeOut",
        delay: 0.6 // Appears after inputs
      }
    }
  };

  // Text fade-in effect for titles and descriptions
  const textVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  // --- Form Handlers ---

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.email || !formData.password) {
      setError('Both email and password are required.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      // Store user data in localStorage (consider more secure methods for production)
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  // --- Component Render ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 to-indigo-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Abstract background shapes/waves for visual interest - remains pure CSS */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
      <div className="absolute bottom-24 right-24 w-48 h-48 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute top-20 right-0 w-36 h-36 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

      {/* Main Form Wrapper - Animated with Framer Motion */}
      <motion.div
        className="relative z-10 bg-[#766363] bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-sm border border-white border-opacity-20"
        variants={formCardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col items-center mb-6">
          {/* Brain Logo and EchoMind Title - Animated with Framer Motion */}
          <motion.div
            className="relative mb-4"
            variants={brainContainerVariants}
          >
            <motion.div
              className="text-6xl text-white drop-shadow-lg"
              variants={brainEmojiVariants}
              animate="pulse"
            >
              🧠
            </motion.div>
            <motion.div
              className="absolute inset-0 bg-blue-400 rounded-full"
              variants={brainGlowVariants}
              animate="glow"
            ></motion.div>
          </motion.div>
          <motion.h1 className="text-4xl font-extrabold text-white mb-2 tracking-wide" variants={textVariants}>EchoMind</motion.h1>
        </div>

        <motion.h2 className="text-2xl font-bold text-white text-center mb-6" variants={textVariants}>Login to Your Account</motion.h2>

        {/* Error message - Animated with Framer Motion for entrance/exit */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} // Use Exit for unmounting (requires AnimatePresence in parent)
            className="bg-red-500 bg-opacity-70 text-white p-3 rounded-lg mb-4 text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input Field - Animated with Framer Motion */}
          <motion.div variants={inputVariants}>
            <label htmlFor="email" className="block text-gray-200 text-sm font-medium mb-1">
              Email
            </label>
            <motion.input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              required
              className="w-full px-4 py-2 bg-white bg-opacity-70 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-600 transition-all duration-300 ease-in-out border border-white border-opacity-40"
              whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }} // Sexy focus effect
            />
          </motion.div>

          {/* Password Input Field - Animated with Framer Motion */}
          <motion.div variants={inputVariants}>
            <label htmlFor="password" className="block text-gray-200 text-sm font-medium mb-1">
              Password
            </label>
            <motion.input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 bg-white bg-opacity-70 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-600 transition-all duration-300 ease-in-out border border-white border-opacity-40"
              whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }} // Sexy focus effect
            />
          </motion.div>

          {/* Login Button - Animated with Framer Motion */}
          <motion.button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-4 focus:ring-purple-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out transform disabled:bg-purple-400 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={loading}
            variants={buttonVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.05 }} // Sexy hover effect
            whileTap={{ scale: 0.95 }} // Sexy active effect
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Login'
            )}
          </motion.button>
        </form>

        {/* Footer Link - Animated with Framer Motion */}
        <motion.div className="mt-6 text-center text-gray-200" variants={textVariants}>
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="text-purple-900 hover:text-purple-100 font-semibold transition-colors duration-200">
              Sign up
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;