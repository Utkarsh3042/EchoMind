import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate for redirection
import React from 'react'; // Don't forget to import React
import { useTranslation } from 'react-i18next'; // Import translation hook

function GameNav({ user }) {
  const navigate = useNavigate(); // Initialize useNavigate hook
  const { t } = useTranslation(); // Initialize translation hook

  const handleLogout = () => {
    // Clear user data from localStorage or context
    localStorage.removeItem('user');
    // Redirect to login or home page
    navigate('/login'); // Assuming '/login' is your login route
  };

  return (
    // Navbar container: purple background, padding, flex layout, rounded corners, shadow
    <nav className="pt-2 relative bg-purple-700 p-4 sm:p-5 flex items-center justify-between rounded-full shadow-lg mb-8 mx-auto w-11/12 sm:w-full max-w-2xl">
      {/* Back button/icon */}
      <Link
        to="/dashboard" // Assuming dashboard is the page to go back to from games
        className="text-white text-2xl font-bold rounded-full hover:bg-purple-600 transition-colors duration-300"
        aria-label={t('goBackToDashboard')}
      >
        &lt; {/* HTML entity for < */}
      </Link>

      {/* Brand/Title with icon */}
      <Link to="/games" className="flex items-center">
        <span className="text-pink-400 text-3xl sm:text-4xl">🧠</span> {/* Using an emoji for now */}
        <span className="text-white text-2xl sm:text-3xl font-extrabold tracking-tight">
          EchoMind
        </span>
      </Link>
      
      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="bg-red-600 text-white text-base sm:text-lg font-semibold py-2 px-4 sm:px-6 rounded-full hover:bg-red-700 transition-colors duration-300 shadow-md"
      >
        {t('logout')}
      </button>

      {/* Removed the patient-selector and user-info as per image reference */}
    </nav>
  );
}

export default GameNav;