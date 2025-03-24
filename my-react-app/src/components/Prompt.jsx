import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import "./Prompt.css";
import { useNavigate } from 'react-router-dom';

function Prompt() {
  const [knownPersons, setKnownPersons] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fadeIn, setFadeIn] = useState(false);

  const navigate = useNavigate();
  const patientId = localStorage.getItem('userId') || '';

  useEffect(() => {
    const fetchKnownPersons = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');

        if (!patientId || !token) {
          setError('Authentication information missing. Please log in again.');
          setIsLoading(false);
          return;
        }

        const response = await axios.get(`http://localhost:5000/api/known-persons/${patientId}`, {
          headers: {
            'x-auth-token': token
          }
        });

        setKnownPersons(response.data.known_persons);

        if (response.data.known_persons.length > 0 && !selectedPersonId) {
          setSelectedPersonId(response.data.known_persons[0].id);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error details:', err);
        if (err.response) {
          console.error('Response data:', err.response.data);
          console.error('Response status:', err.response.status);
        }
        setError('Failed to fetch known persons. Please try again later.');
        setIsLoading(false);
      }
    };

    if (patientId) {
      fetchKnownPersons();
    }
  }, [patientId, selectedPersonId]);

  useEffect(() => {
    if (summaryData) {
      setFadeIn(false);
      const timer = setTimeout(() => {
        setFadeIn(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [summaryData]);

  const fetchDateSummary = async () => {
    if (!selectedPersonId) {
      setError('Please select a known person first');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSummaryData(null);
      
      const response = await axios.get('http://localhost:5000/api/summarize-conversation', {
        params: {
          patient_id: patientId,
          known_person_id: selectedPersonId,
          date: selectedDate
        }
      });
      
      setSummaryData(response.data);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch summary. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching summary:', err);
    }
  };

  const fetchAllSummaries = async () => {
    if (!selectedPersonId) {
      setError('Please select a known person first');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSummaryData(null);
      
      const response = await axios.get('http://localhost:5000/api/summarize-all-conversations', {
        params: {
          patient_id: patientId,
          known_person_id: selectedPersonId
        }
      });
      
      setSummaryData(response.data);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch all summaries. Please try again later.');
      setIsLoading(false);
      console.error('Error fetching all summaries:', err);
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handlePersonChange = (e) => {
    setSelectedPersonId(e.target.value);
    setSummaryData(null);
  };

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

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  const handleLogoutClick = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/');
  };

  const getSelectedPersonName = () => {
    const person = knownPersons.find(p => p.known_person_id === selectedPersonId);
    return person ? person.name : 'Unknown Person';
  };

  const renderSummaryContent = (summary) => {
    if (!summary) return null;
    
    // Process the summary text to identify sections
    const sections = {};
    let currentSection = null;
    let currentContent = [];
    
    summary.split('\n').forEach(line => {
      // Check if this line is a section header
      const sectionMatch = line.match(/\*\*(.*?):\*\*/);
      
      if (sectionMatch) {
        // If we were building a previous section, save it
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n');
          currentContent = [];
        }
        
        // Start a new section
        currentSection = sectionMatch[1];
        // Add the rest of the line after the section header
        const remainingContent = line.replace(sectionMatch[0], '').trim();
        if (remainingContent) {
          currentContent.push(remainingContent);
        }
      } else if (line.trim()) {
        // Add content to the current section
        currentContent.push(line);
      }
    });
    
    // Save the last section
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n');
    }
    
    // If no sections were found, treat the whole text as one section
    if (Object.keys(sections).length === 0 && summary.trim()) {
      sections['Summary'] = summary;
    }
    
    // Render the sections
    return (
      <div className="summary-sections">
        {Object.entries(sections).map(([title, content], index) => (
          <div key={index} className="summary-section">
            <h4 className="summary-section-title">{title}</h4>
            <div className="summary-section-content">
              {content.split('\n').map((paragraph, idx) => {
                // Check if this is a bullet point
                if (paragraph.trim().startsWith('*')) {
                  return (
                    <ul key={idx} className="summary-bullets">
                      {paragraph.split('*').filter(item => item.trim()).map((item, bulletIdx) => (
                        <li key={bulletIdx}>{item.trim()}</li>
                      ))}
                    </ul>
                  );
                } else {
                  return <p key={idx}>{paragraph}</p>;
                }
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container">
      <nav className="app-nav">
        <h1>Conversation Insights</h1>
        <div className="nav-buttons">
          <button onClick={handleDashboardClick} className="nav-button">
            Dashboard
          </button>
          <button onClick={handleLogoutClick} className="nav-button">
            Logout
          </button>
        </div>
      </nav>
      
      {error && (
        <div className="error-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="9"></circle>
            <line x1="10" y1="6" x2="10" y2="10"></line>
            <line x1="10" y1="14" x2="10.01" y2="14"></line>
          </svg>
          {error}
        </div>
      )}

      <div className="control-panel">
        <div className="form-group">
          <label htmlFor="personSelect" className="form-label">
            Select Known Person
          </label>
          <select
            id="personSelect"
            value={selectedPersonId}
            onChange={handlePersonChange}
            className="form-select"
            disabled={isLoading || knownPersons.length === 0}
          >
            <option value="">Select a person...</option>
            {knownPersons.map((person) => (
              <option key={person.known_person_id} value={person.known_person_id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="dateSelect" className="form-label">
            Select Date for Single Day Summary
          </label>
          <input
            type="date"
            id="dateSelect"
            value={selectedDate}
            onChange={handleDateChange}
            className="form-input"
            max={format(new Date(), 'yyyy-MM-dd')}
            disabled={isLoading}
          />
        </div>

        <div className="button-container">
          <button
            onClick={fetchDateSummary}
            disabled={isLoading || !selectedPersonId}
            className="btn btn-primary"
          >
            {isLoading ? (
              <>
                <span className="animate-pulse">Loading...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Get Summary for Selected Date
              </>)}
          </button>
          
          <button
            onClick={fetchAllSummaries}
            disabled={isLoading || !selectedPersonId}
            className="btn btn-success"
          >
            {isLoading ? (
              <>
                <span className="animate-pulse">Loading...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Get All Conversations Summary
              </>
            )}
          </button>
        </div>
      </div>

      {summaryData && (
        <div className={`results-card ${fadeIn ? 'fade-in' : ''}`} style={{ 
          opacity: fadeIn ? 1 : 0,
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          transform: fadeIn ? 'translateY(0)' : 'translateY(10px)'
        }}>
          <div className="card-header">
            <h2 className="card-title">
              {summaryData.date 
                ? `Summary for ${formatDate(summaryData.date)}`
                : `All Conversation Insights with ${getSelectedPersonName()}`}
            </h2>
            <div className="insights-stats">
              <div className="stat-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>{summaryData.conversation_count} messages</span>
              </div>
              <div className="stat-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                <span>{summaryData.conversation_length} characters</span>
              </div>
            </div>
          </div>
          
          <div className="card-body">
            <div className="card-section insights-section">
              <h3 className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="section-icon">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Key Insights
              </h3>
              {summaryData.success ? (
                <div className="summary-content conversation-text">
                  {renderSummaryContent(summaryData.summary)}
                </div>
              ) : (
                <p className="text-warning">
                  {summaryData.summary || 'No summary available for this conversation'}
                </p>
              )}
            </div>
            
            {summaryData.original_messages && summaryData.original_messages.length > 0 && (
              <div className="card-section messages-section">
                <h3 className="section-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="section-icon">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Original Messages
                </h3>
                <div className="message-container">
                  {summaryData.original_messages.map((message, index) => (
                    <div key={index} className={`message-item ${message.speaker === 'You' ? 'message-self' : 'message-other'}`}>
                      <div className="message-header">
                        <span className="message-sender">{message.speaker}</span>
                        <span className="message-time">
                          {new Date(message.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="message-bubble">
                        <p className="message-content">{message.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {summaryData.messages_by_date && Object.keys(summaryData.messages_by_date).length > 0 && (
              <div className="card-section history-section">
                <h3 className="section-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="section-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Conversation History
                </h3>
                
                <div className="conversation-timeline">
                  {summaryData.conversation_dates && summaryData.conversation_dates.map((date, idx) => (
                    <div key={date} className={`timeline-day ${idx === 0 ? 'first-day' : ''}`}>
                      <div className="day-marker">
                        <div className="day-marker-dot"></div>
                        <h4 className="message-date-header">
                          {formatDate(date)}
                        </h4>
                      </div>
                      <div className="timeline-messages">
                        {summaryData.messages_by_date[date].map((message, index) => (
                          <div key={index} className={`message-item ${message.speaker === 'You' ? 'message-self' : 'message-other'}`}>
                            <div className="message-header">
                              <span className="message-sender">{message.speaker}</span>
                              <span className="message-time">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="message-bubble">
                              <p className="message-content">{message.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {isLoading && !summaryData && (
        <div className="loading-state">
          <div className="loading-icon"></div>
          <p>Analyzing conversations...</p>
        </div>
      )}

      {!isLoading && !summaryData && selectedPersonId && (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p className="text-gray-600">Select options and click a button to see conversation summaries</p>
        </div>
      )}
    </div>
  );
}

export default Prompt;