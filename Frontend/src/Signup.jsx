import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; // Import motion

const Signup = ({ onSignup }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    phone: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Variants for animations
  const formCardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut",
        when: "beforeChildren", // Animate parent first
        staggerChildren: 0.1 // Stagger child animations
      }
    }
  };

  const brainContainerVariants = {
    hidden: { scale: 0.75, opacity: 0 },
    visible: {
      scale: 1.25,
      opacity: 1,
      transition: {
        duration: 1.2,
        ease: "easeOut",
        delay: 0.3 // Stagger after card appears
      }
    }
  };

  const brainEmojiVariants = {
    pulse: {
      filter: [
        'drop-shadow(0 0 5px rgba(255, 255, 255, 0.4))',
        'drop-shadow(0 0 15px rgba(255, 255, 255, 0.8))',
        'drop-shadow(0 0 5px rgba(255, 255, 255, 0.4))'
      ],
      transition: {
        duration: 2,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror"
      }
    }
  };

  const brainGlowVariants = {
    glow: {
      opacity: [0, 0.4, 0],
      transition: {
        duration: 1.5,
        ease: "easeOut",
        repeat: Infinity,
        repeatDelay: 1
      }
    }
  };

  const inputVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: [0, -10, -5, 0], // Bounce effect
      transition: {
        duration: 0.8,
        ease: "easeOut",
        delay: 0.8 // Animate after inputs
      }
    }
  };

  const textVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validateForm = () => {
    const requiredFields = ['name', 'email', 'password', 'confirmPassword', 'age', 'phone'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(`Please fill in your ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}.`);
        return false;
      }
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return false;
    }

    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('Please enter a valid phone number (10-15 digits).');
      return false;
    }

    if (isNaN(formData.age) || parseInt(formData.age) < 1 || parseInt(formData.age) > 120) {
      setError('Please enter a valid age (1-120).');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data.user || { email: formData.email, name: formData.name }));
        if (onSignup) onSignup();
        navigate('/login');
      } else {
        setError(data.message || 'Signup failed. Please try again.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to connect to server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 to-indigo-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Abstract background shapes/waves for visual interest - consistent with Login */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
      <div className="absolute bottom-24 right-24 w-48 h-48 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute top-20 right-0 w-36 h-36 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

      {/* Main Form Wrapper - Framer Motion Animation */}
      <motion.div
        className="relative z-10 bg-[#766363] bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-sm border border-white border-opacity-20"
        variants={formCardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col items-center mb-6">
          {/* Brain Logo - Framer Motion Animation */}
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

        <motion.h2 className="text-2xl font-bold text-white text-center mb-6" variants={textVariants}>Create Your Account</motion.h2>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500 bg-opacity-70 text-white p-3 rounded-lg mb-4 text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <motion.div variants={inputVariants}>
            <label htmlFor="name" className="block text-gray-200 text-sm font-medium mb-1">
              Full Name
            </label>
            <motion.input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your full name"
              required
              className="w-full px-4 py-2 bg-white bg-opacity-70 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-600 transition-all duration-300 ease-in-out border border-white border-opacity-40"
              whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }} // Sexy focus animation
            />
          </motion.div>

          {/* Email */}
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
              whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }}
            />
          </motion.div>

          {/* Phone and Age - Responsive Layout */}
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
            <motion.div className="form-group flex-1" variants={inputVariants}>
              <label htmlFor="phone" className="block text-gray-200 text-sm font-medium mb-1">
                Phone Number
              </label>
              <motion.input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1234567890"
                required
                className="w-full px-4 py-2 bg-white bg-opacity-70 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-600 transition-all duration-300 ease-in-out border border-white border-opacity-40"
                whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }}
              />
            </motion.div>

            <motion.div className="form-group flex-1" variants={inputVariants}>
              <label htmlFor="age" className="block text-gray-200 text-sm font-medium mb-1">
                Age
              </label>
              <motion.input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="e.g., 30"
                min="1"
                required
                className="w-full px-4 py-2 bg-white bg-opacity-70 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-600 transition-all duration-300 ease-in-out border border-white border-opacity-40"
                whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }}
              />
            </motion.div>
          </div>

          {/* Password */}
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
              placeholder="Create a strong password"
              required
              className="w-full px-4 py-2 bg-white bg-opacity-70 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-600 transition-all duration-300 ease-in-out border border-white border-opacity-40"
              whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }}
            />
          </motion.div>

          {/* Confirm Password */}
          <motion.div variants={inputVariants}>
            <label htmlFor="confirmPassword" className="block text-gray-200 text-sm font-medium mb-1">
              Confirm Password
            </label>
            <motion.input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
              className="w-full px-4 py-2 bg-white bg-opacity-70 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-600 transition-all duration-300 ease-in-out border border-white border-opacity-40"
              whileFocus={{ scale: 1.01, boxShadow: "0 0 5px rgba(139, 92, 246, 0.5)" }}
            />
          </motion.div>

          {/* Signup Button */}
          <motion.button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-4 focus:ring-purple-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out transform disabled:bg-purple-400 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={loading}
            variants={buttonVariants}
            initial="hidden" // Use initial from buttonVariants
            animate="visible" // Use visible from buttonVariants
            whileHover={{ scale: 1.05 }} // Sexy hover effect
            whileTap={{ scale: 0.95 }} // Sexy active effect
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Sign Up'
            )}
          </motion.button>
        </form>

        {/* Footer Link */}
        <motion.div className="mt-6 text-center text-gray-200" variants={textVariants}>
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-purple-900 hover:text-purple-100 font-semibold transition-colors duration-200">
              Log in
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Signup;