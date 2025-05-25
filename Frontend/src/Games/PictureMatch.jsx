import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import GameNav from './GameNav';
import './PictureMatch.css'; // Import your CSS styles for the game

// Icons as emoji for simplicity
const icons = [
  '🍎', '🚗', '🌈', '🐶', '🌮', '🦋'
];

// Score messages based on time taken (lower time is better)
const getScoreMessage = (time) => {
  if (time <= 10) return "Phenomenal speed! You're a memory master! 🏆";
  if (time <= 15) return "Excellent! Your memory is truly impressive! ⭐️";
  if (time <= 20) return "Great job! You have amazing recall ability! 🎯";
  if (time <= 25) return "Very good! Your memory skills are strong! 👏";
  if (time <= 30) return "Good work! Keep practicing to improve further! 👍";
  if (time <= 35) return "Nice effort! You're getting better! 🙂";
  if (time <= 40) return "Not bad! With more practice, you'll improve! 🌱";
  if (time <= 45) return "Keep trying! Practice makes perfect! 💪";
  if (time <= 50) return "Good start! Your memory will improve with practice! 🔄";
  return "Thanks for playing! Try again to improve your score! 🎮";
};

function PictureMatch() {
  const [user, setUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [gameState, setGameState] = useState('idle'); // idle, playing, complete
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(0);
  const [score, setScore] = useState(0);
  const [scoreMessage, setScoreMessage] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  
  // Load user data from localStorage on component mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    }
  }, []);
  
  useEffect(() => {
    let interval;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setTimer(prevTimer => prevTimer + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);
  
  // When gameState changes to complete, save the score
  useEffect(() => {
    if (gameState === 'complete' && score > 0 && user?.user_id) {
      saveScore();
    }
  }, [gameState, score, user]);
  
  const saveScore = async () => {
    // Reset state for new save attempt
    setSaveError(null);
    setScoreSaved(false);
    
    if (!user?.user_id) {
      setSaveError("No user ID available");
      return;
    }
    
    try {
      const scoreData = {
        patient_id: user.user_id,
        game_name: 'picture-match',
        score: score,
        user_name: user.name || 'Unknown User'
      };
      
      console.log("Saving score:", scoreData);
      
      // const response = await axios.post('http://localhost:5000/api/games', scoreData);
      const response = await axios.post('https://echomind-6.onrender.com/api/games', scoreData);
      
      console.log("Save score response:", response.data);
      
      if (response.data.success) {
        setScoreSaved(true);
        // Set score message
        setScoreMessage(getScoreMessage(timer));
      } else {
        setSaveError("Failed to save score: " + response.data.error);
      }
    } catch (error) {
      console.error('Error saving score:', error);
      const errorMessage = error.response?.data?.error || error.message;
      setSaveError("Error saving score: " + errorMessage);
    }
  };
  
  const startGame = () => {
    // Create a shuffled deck of cards with pairs
    const shuffledCards = [...icons, ...icons]
      .sort(() => Math.random() - 0.5)
      .map((icon, index) => ({ id: index, icon, flipped: false, matched: false }));
    
    setCards(shuffledCards);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setTimer(0);
    setScore(0);
    setGameState('playing');
    setScoreMessage('');
    setScoreSaved(false);
    setSaveError(null);
  };
  
  const handleCardClick = (cardId) => {
    if (
      gameState !== 'playing' || 
      flipped.length >= 2 || 
      flipped.includes(cardId) || 
      matched.includes(cardId)
    ) {
      return;
    }
    
    // Flip the card
    const newFlipped = [...flipped, cardId];
    setFlipped(newFlipped);
    
    // Check for match if we have two cards flipped
    if (newFlipped.length === 2) {
      setMoves(prevMoves => prevMoves + 1);
      
      const card1 = cards.find(card => card.id === newFlipped[0]);
      const card2 = cards.find(card => card.id === newFlipped[1]);
      
      if (card1.icon === card2.icon) {
        // Match found
        setMatched(prevMatched => [...prevMatched, ...newFlipped]);
        setFlipped([]);
        
        // Check if all cards are matched
        if (matched.length + 2 === cards.length) {
          // Game complete - score is the time taken (lower is better)
          setScore(timer);
          setGameState('complete');
          // Score saving is handled by useEffect
        }
      } else {
        // No match - flip back after a delay
        setTimeout(() => {
          setFlipped([]);
        }, 1000);
      }
    }
  };
  
  // Format timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  return (
    <div className="game-page min-h-screen py-8 px-4 sm:px-6 lg:px-8 relative bg-green-50">
      <GameNav user={user} />
      
      <div className="game-header">
        <Link style={{color:"black", display:"flex", fontSize:"15px",width:"30%"}} to="/games" className="back-button">
          ← Back to Games
        </Link>
        <div>
          Time: {formatTime(timer)}
        </div>
      </div>
      
      <div className="game-content">
        <h2 className="game-title-header">Picture Match</h2>
        
        {gameState === 'idle' && (
          <div className="instructions">
            <p>Find matching pairs of cards by turning them over two at a time.</p>
            <p>Try to complete the game in the shortest time possible!</p>
            <button className="start-button" onClick={startGame}>
              Start Game
            </button>
          </div>
        )}
        
        {gameState === 'complete' && (
          <div className="game-complete">
            <h3>Congratulations!</h3>
            <p>You completed the game in {moves} moves and {formatTime(timer)}.</p>
            <p>Your score: {timer} seconds (lower is better)</p>
            
            {scoreMessage && (
              <div className="score-message">
                {scoreMessage}
              </div>
            )}
            
            {scoreSaved && <p className="score-saved">Score saved successfully!</p>}
            {saveError && <p className="score-error">Error: {saveError}</p>}
            
            <button className="start-button" onClick={startGame}>
              Play Again
            </button>
          </div>
        )}
        
        {gameState === 'playing' && (
          <div className="game-stats">
            <div>Moves: {moves}</div>
            <div>Matched: {matched.length/2} / {cards.length/2}</div>
            <div>Time: {formatTime(timer)}</div>
          </div>
        )}
        
        {gameState === 'playing' && (
          <div className="cards-grid">
            {cards.map(card => (
              <div
                key={card.id}
                className={`card ${flipped.includes(card.id) ? 'flipped' : ''} ${matched.includes(card.id) ? 'matched' : ''}`}
                onClick={() => handleCardClick(card.id)}
              >
                <div className="card-back">?</div>
                <div className="card-front">{card.icon}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PictureMatch;