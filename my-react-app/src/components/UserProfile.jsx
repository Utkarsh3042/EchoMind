import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './UserProfile.css'; // Import the CSS file

function UserProfile() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:5000/api/auth/user', {
          headers: {
            'x-auth-token': token,
          },
        });
        setUserData(response.data);
        setLoading(false);
      } catch (err) {
        // If error, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        navigate('/login');
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2>User Profile</h2>
        <div className="header-buttons">
          <button onClick={() => navigate('/dashboard')} className="navigation-button dashboard-button">
            Dashboard
          </button>
          <button onClick={handleLogout} className="navigation-button logout-button">
            Logout
          </button>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-avatar">
            {userData.name.charAt(0).toUpperCase()}
          </div>

          <div className="profile-info">
            <h3 className="profile-name">{userData.name}</h3>
            <p className="profile-email">{userData.email}</p>

            <div className="profile-details">
              <div className="detail-item">
                <span className="detail-label">Age</span>
                <span className="detail-value">{userData.age}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">User ID</span>
                <span className="detail-value id-value">{userData._id}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Account Created</span>
                <span className="detail-value">
                  {new Date(userData.date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;