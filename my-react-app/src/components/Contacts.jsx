import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Contacts.css';

function Contacts() {
  const [knownPersons, setKnownPersons] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'conversations'
  
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/auth/user', {
          headers: {
            'x-auth-token': token,
          },
        });
        setUserData(response.data);
        setLoading(false);
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        navigate('/login');
      }
    };

    fetchUserData();
  }, [navigate, token]);

  useEffect(() => {
    if (!userId || !token) {
      setError('User ID or token not found. Please log in.');
      return;
    }

    const fetchKnownPersons = async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/api/known-persons/${userId}`,
          {
            headers: {
              'x-auth-token': token,
            },
          }
        );
        setKnownPersons(response.data.known_persons);
      } catch (err) {
        if (err.response) {
          setError(err.response.data.message);
        } else {
          setError('An unexpected error occurred.');
        }
      }
    };

    fetchKnownPersons();
  }, [userId, token]);

  const fetchConversations = async (personId) => {
    setLoadingConversations(true);
    try {
      // This is a placeholder. You'll need to implement the actual API endpoint
      const response = await axios.get(
        `http://localhost:5000/api/conversations/${userId}/${personId}`,
        {
          headers: {
            'x-auth-token': token,
          },
        }
      );
      setConversations(response.data.conversations || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      // If the API doesn't exist yet, use mock data
      setConversations([
        {
          id: '1',
          date: new Date().toISOString(),
          messages: [
            { speaker: 'You', text: 'Hello, how are you today?', timestamp: new Date().toISOString() },
            { speaker: selectedPerson?.name, text: 'I\'m doing well, thanks for asking!', timestamp: new Date().toISOString() }
          ]
        },
        {
          id: '2',
          date: new Date(Date.now() - 86400000).toISOString(), // yesterday
          messages: [
            { speaker: 'You', text: 'Did you get my email?', timestamp: new Date(Date.now() - 86400000).toISOString() },
            { speaker: selectedPerson?.name, text: 'Yes, I\'ll respond to it soon.', timestamp: new Date(Date.now() - 86400000).toISOString() }
          ]
        }
      ]);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setActiveTab('details');
    fetchConversations(person.known_person_id);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(word => word.charAt(0).toUpperCase()).join('').substring(0, 2);
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString;
    }
  };

  // Random colors for avatars
  const getAvatarColor = (personId) => {
    const colors = [
      '#4361ee', '#3a0ca3', '#f72585', '#7209b7', '#3f37c9',
      '#4cc9f0', '#4895ef', '#560bad', '#f15bb5', '#00bbf9'
    ];
    // Generate a consistent index based on the personId
    const sumChars = personId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[sumChars % colors.length];
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  if (error) {
    return <div className="error-display">{error}</div>;
  }

  return (
    <div className="contacts-page">
      {/* Header */}
      <header className="contacts-header">
        <div className="profile-section">
          <div className="user-avatar" style={{ backgroundColor: getAvatarColor(userData._id) }}>
            {getInitials(userData.name)}
          </div>
          <div className="user-info">
            <h3>{userData.name}</h3>
            <p className="user-email">{userData.email}</p>
          </div>
        </div>
        <div className="header-buttons">
          <Link to="/dashboard" className="nav-button">Dashboard</Link>
          <Link to="/prompt" className="nav-button">Insights</Link>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>

      {/* Main content */}
      <div className="contacts-main">
        {/* Contacts sidebar */}
        <div className="contacts-sidebar">
          <div className="sidebar-header">
            <h2>Contacts</h2>
            <div className="search-container">
              <input 
                type="text" 
                placeholder="Search contacts..." 
                className="search-input"
              />
              <span className="search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
            </div>
          </div>
          
          <div className="contacts-list">
            {knownPersons.length > 0 ? (
              knownPersons.map((person) => (
                <div 
                  key={person.known_person_id} 
                  className={`contact-card ${selectedPerson?.known_person_id === person.known_person_id ? 'selected' : ''}`}
                  onClick={() => handleSelectPerson(person)}
                >
                  <div 
                    className="contact-avatar" 
                    style={{ backgroundColor: getAvatarColor(person.known_person_id) }}
                  >
                    {getInitials(person.name)}
                  </div>
                  <div className="contact-info">
                    <h3 className="contact-name">{person.name}</h3>
                    <p className="contact-preview">Click to view details</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-contacts">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <p>No contacts found</p>
              </div>
            )}
          </div>
        </div>

        {/* Details panel */}
        {selectedPerson ? (
          <div className="details-panel">
            <div className="details-header">
              <div 
                className="detail-avatar" 
                style={{ backgroundColor: getAvatarColor(selectedPerson.known_person_id) }}
              >
                {getInitials(selectedPerson.name)}
              </div>
              <div className="detail-name-container">
                <h2 className="detail-name">{selectedPerson.name}</h2>
                <div className="action-buttons">
                  <button className="action-button message-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Message
                  </button>
                  <button className="action-button call-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    Call
                  </button>
                </div>
              </div>
            </div>

            <div className="tab-navigation">
              <button 
                className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => handleTabChange('details')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                Details
              </button>
              <button 
                className={`tab-button ${activeTab === 'conversations' ? 'active' : ''}`}
                onClick={() => handleTabChange('conversations')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Conversations
              </button>
            </div>

            <div className="detail-content">
              {activeTab === 'details' && (
                <div className="person-details">
                  <div className="detail-card">
                    <h3 className="detail-section-title">Contact Information</h3>
                    <div className="detail-item">
                      <span className="detail-label">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Full Name
                      </span>
                      <span className="detail-value">{selectedPerson.name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        Email
                      </span>
                      <span className="detail-value">{selectedPerson.email || 'Not available'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Phone
                      </span>
                      <span className="detail-value">{selectedPerson.phone || 'Not available'}</span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <h3 className="detail-section-title">System Information</h3>
                    <div className="detail-item">
                      <span className="detail-label">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        Contact ID
                      </span>
                      <span className="detail-value id-value">{selectedPerson.known_person_id}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        Recent Activity
                      </span>
                      <span className="detail-value">Last conversation on {formatDate(new Date())}</span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <h3 className="detail-section-title">Quick Actions</h3>
                    <div className="action-grid">
                      <button className="grid-action">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit Contact
                      </button>
                      <button className="grid-action">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        Schedule
                      </button>
                      <button className="grid-action">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        Get Insights
                      </button>
                      <button className="grid-action">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                          <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        View Notes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'conversations' && (
                <div className="conversations-panel">
                  {loadingConversations ? (
                    <div className="loading-conversations">
                      <div className="loading-spinner"></div>
                      <p>Loading conversations...</p>
                    </div>
                  ) : conversations.length > 0 ? (
                    <div className="conversation-timeline">
                      {conversations.map((conversation) => (
                        <div key={conversation.id} className="conversation-day">
                          <div className="conversation-date">
                            <div className="date-line"></div>
                            <span className="date-text">{formatDate(conversation.date)}</span>
                            <div className="date-line"></div>
                          </div>
                          <div className="conversation-messages">
                            {conversation.messages.map((message, index) => (
                              <div 
                                key={index} 
                                className="conversation-message"
                              >
                                <div className="message-info">
                                  <span className="message-time">
                                    {new Date(message.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit', 
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <div className="message-content">
                                  <p>{message.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-conversations">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <p>No conversations with this contact yet</p>
                      <button className="start-conversation-btn">Start a conversation</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-selection">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h3>Select a contact to view details</h3>
            <p>Your contacts will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Contacts;