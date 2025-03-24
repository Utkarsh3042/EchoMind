import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard'
import Prompt from './components/Prompt';
import Contacts from './components/contacts';
import UserProfile from './components/UserProfile'; 

import './App.css';

function App() {
  useEffect(() => {
    // Apply smooth scrolling to the entire application
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Clean up on unmount
    return () => {
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/Dashboard" element={<Dashboard />} />
          <Route path="/prompt" element={<Prompt />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/userprofile" element={<UserProfile />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;