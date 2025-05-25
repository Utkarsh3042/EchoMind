import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion'; // Import motion and AnimatePresence
import GameNav from './GameNav'; // Assuming GameNav is a separate component

function VisualLocationMemory() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('idle'); // idle, memorize, recall, complete
  const [grid, setGrid] = useState([]);
  const [correctLocations, setCorrectLocations] = useState([]);
  const [playerSelections, setPlayerSelections] = useState([]);
  const [gridSize, setGridSize] = useState(4); // 4x4 grid to start
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(null);
  const [timeToMemorize, setTimeToMemorize] = useState(3); // Changed from 5 to 3 seconds
  const [saveError, setSaveError] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [remainingLives, setRemainingLives] = useState(3);

  // Framer Motion Variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4, ease: "easeIn" } },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.3 } },
  };

  const buttonHoverTap = {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 }
  };

  const cellVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 15 } },
    hasObject: {
      backgroundColor: ["#475569", "#3b82f6"], // From gray-600 to blue-500
      boxShadow: "0 0 20px rgba(59, 130, 246, 0.7)",
      scale: [1, 1.1, 1], // Small pulse
      transition: { duration: 0.5, ease: "easeOut" }
    },
    selected: {
      backgroundColor: ["#e0e0e0", "#22c55e"], // From light gray (hover) or gray-600 to green-500
      color: "#fff",
      boxShadow: "0 0 15px rgba(34, 197, 94, 0.7)",
      scale: [1, 1.05], // Small pop
      transition: { duration: 0.2, ease: "easeOut" }
    },
    recallHover: { scale: 1.05, backgroundColor: "#4b5563" }, // dark gray
    recallTap: { scale: 0.95, backgroundColor: "#374151" } // even darker gray
  };

  const textVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.2 } },
  };


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

  // When game state changes to complete, save the score
  useEffect(() => {
    if (gameState === 'complete' && score > 0 && user?.user_id) {
      saveScore();
    }
  }, [gameState, score, user]);

  useEffect(() => {
    let interval;
    if (gameState === 'memorize' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prevTimer => Math.max(0, prevTimer - 1));
      }, 1000);
    } else if (gameState === 'memorize' && timer === 0) {
      setGameState('recall');
    }
    return () => clearInterval(interval);
  }, [gameState, timer]);

  const saveScore = async () => {
    setSaveError(null);
    setScoreSaved(false);

    if (!user?.user_id) {
      setSaveError("No user ID available");
      return;
    }

    try {
      const scoreData = {
        patient_id: user.user_id,
        game_name: 'visual-location-memory',
        score: score,
        user_name: user.name || 'Unknown User'
      };

      console.log("Saving score:", scoreData);

      const response = await axios.post('http://localhost:5000/api/games', scoreData);
      // const response = await axios.post('https://echomind-6.onrender.com/api/games', scoreData);

      console.log("Save score response:", response.data);

      if (response.data.success) {
        setScoreSaved(true);
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
    setScore(0);
    setLevel(1);
    setRemainingLives(3);
    setSaveError(null);
    setScoreSaved(false);
    setGridSize(4); // Start with 4x4 grid
    setTimeToMemorize(3); // Initial timer
    startNewRound();
  };

  const startNewRound = () => {
    const emptyGrid = Array(gridSize * gridSize).fill(false);

    const objectCount = Math.min(3 + Math.floor(level / 2), Math.floor(gridSize * gridSize * 0.4)); // Max 40% of grid
    if (objectCount === 0) { // Ensure at least one object
      objectCount = 1;
    }
    
    const objectLocations = [];
    while (objectLocations.length < objectCount) {
      const randomPosition = Math.floor(Math.random() * (gridSize * gridSize));
      if (!objectLocations.includes(randomPosition)) {
        objectLocations.push(randomPosition);
      }
    }

    const newGrid = [...emptyGrid];
    objectLocations.forEach(position => {
      newGrid[position] = true;
    });

    setGrid(newGrid);
    setCorrectLocations(objectLocations);
    setPlayerSelections([]);
    setTimer(Math.ceil(timeToMemorize)); // Ensure timer is an integer for display
    setGameState('memorize');
  };

  const handleCellClick = (index) => {
    if (gameState !== 'recall') return;

    // Toggle selection
    let newSelections;
    if (playerSelections.includes(index)) {
      newSelections = playerSelections.filter(pos => pos !== index);
    } else {
      newSelections = [...playerSelections, index];
    }

    setPlayerSelections(newSelections);
  };

  const submitAnswers = () => {
    if (gameState !== 'recall') return;

    let correct = true;
    let matches = 0;

    // Check if player selected all correct locations
    if (playerSelections.length !== correctLocations.length) {
      correct = false;
    } else {
      // Check each selection
      for (const selection of playerSelections) {
        if (correctLocations.includes(selection)) {
          matches++;
        } else {
          correct = false;
          break;
        }
      }
    }

    const pointsPerCorrect = 10;
    const earnedPoints = matches * pointsPerCorrect;

    if (correct) {
      setScore(prevScore => prevScore + earnedPoints);
      setLevel(prevLevel => prevLevel + 1);

      // Increase grid size every 3 levels, max 6x6
      if (level % 3 === 0 && gridSize < 6) {
        setGridSize(prevSize => prevSize + 1);
      }

      // Decrease memorization time as levels progress, but not below 1.5 seconds
      if (level % 2 === 0) {
        setTimeToMemorize(prevTime => Math.max(1.5, prevTime - 0.5));
      }

      startNewRound();
    } else {
      setScore(prevScore => prevScore + earnedPoints); // Add partial points for partial matches

      const newLives = remainingLives - 1;
      setRemainingLives(newLives);

      if (newLives <= 0) {
        setGameState('complete');
      } else {
        startNewRound();
      }
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-gray-100 py-8 px-4 sm:px-6 lg:px-8 relative"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <GameNav user={user} />

      <div className="flex justify-between items-center max-w-4xl mx-auto mb-8 px-4">
        <Link to="/games" className="flex items-center space-x-1 text-blue-400 hover:text-blue-600 transition-colors duration-300 text-sm md:text-base">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Games</span>
        </Link>
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
          <span>Score: <span className="text-white">{score}</span></span>
          <span>Level: <span className="text-white">{level}</span></span>
          <span>Lives: <span className="text-white">{'💚'.repeat(remainingLives)}</span></span>
        </div>
      </div>

      <motion.div
        className="max-w-md mx-auto text-center bg-gray-800 bg-opacity-70 p-6 rounded-lg shadow-xl border border-gray-700"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold text-orange-500 mb-6">Visual Location Memory</h2>

        <AnimatePresence mode="wait">
          {gameState === 'idle' && (
            <motion.div
              key="idle"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4 mb-6"
            >
              <p className="text-gray-300">Remember the locations of the stars shown on the grid.</p>
              <p className="text-gray-300">After they disappear, click on the cells where you saw them.</p>
              <motion.button
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={startGame}
                {...buttonHoverTap}
              >
                Start Game
              </motion.button>
            </motion.div>
          )}

          {gameState === 'complete' && (
            <motion.div
              key="complete"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4 mb-6"
            >
              <h3 className="text-2xl font-bold text-orange-500">Game Over!</h3>
              <p className="text-lg text-gray-300">Your final score: <span className="text-white font-bold">{score}</span></p>
              <p className="text-lg text-gray-300">You reached level: <span className="text-white font-bold">{level}</span></p>
              {scoreSaved && <p className="text-green-400 font-semibold">Score saved successfully!</p>}
              {saveError && <p className="text-red-400 font-semibold">Error: {saveError}</p>}
              <motion.button
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={startGame}
                {...buttonHoverTap}
              >
                Play Again
              </motion.button>
            </motion.div>
          )}

          {gameState === 'memorize' && (
            <motion.div
              key="memorize"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={timer} // Key changes to animate timer text
                  variants={textVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="text-xl font-bold mb-4 text-red-400"
                >
                  Memorize the star positions: <span className="font-extrabold text-white">{timer}</span> seconds
                </motion.div>
              </AnimatePresence>

              <motion.div
                className="grid gap-2 mx-auto w-full max-w-xs md:max-w-sm aspect-square p-2 bg-gray-700 rounded-lg shadow-inner border border-gray-600"
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: { staggerChildren: 0.05, delayChildren: 0.2 }
                  }
                }}
              >
                {grid.map((hasObject, index) => (
                  <motion.div
                    key={index}
                    className={`aspect-square bg-gray-600 rounded-md flex items-center justify-center text-2xl font-bold shadow-md border border-gray-500`}
                    variants={cellVariants}
                    initial="hidden"
                    animate={hasObject ? "hasObject" : "visible"} // Animate directly to hasObject if true
                  >
                    {hasObject && '⭐'}
                  </motion.div>
                ))}
              </motion.div>

              <AnimatePresence>
                <motion.div
                  key="instruction-mem"
                  variants={textVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="text-lg font-semibold my-4 text-blue-400"
                >
                  Remember where the stars are located!
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {gameState === 'recall' && (
            <motion.div
              key="recall"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              <AnimatePresence>
                <motion.div
                  key="instruction-rec"
                  variants={textVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="text-lg font-semibold my-4 text-blue-400"
                >
                  <strong>Click on the cells where you saw the stars!</strong>
                </motion.div>
              </AnimatePresence>

              <motion.div
                className="grid gap-2 mx-auto w-full max-w-xs md:max-w-sm aspect-square p-2 bg-gray-700 rounded-lg shadow-inner border border-gray-600"
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: { staggerChildren: 0.05, delayChildren: 0.2 }
                  }
                }}
              >
                {grid.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`aspect-square bg-gray-600 rounded-md flex items-center justify-center text-2xl font-bold shadow-md border border-gray-500
                      ${playerSelections.includes(index) ? 'selected' : 'recall-cell'}
                    `}
                    onClick={() => handleCellClick(index)}
                    variants={cellVariants}
                    initial="hidden" // Each cell fades in when grid appears
                    animate={playerSelections.includes(index) ? "selected" : "visible"} // Animate to 'selected' or 'visible' base state
                    whileHover="recallHover"
                    whileTap="recallTap"
                  >
                    {playerSelections.includes(index) && '✅'}
                  </motion.div>
                ))}
              </motion.div>

              <AnimatePresence mode="wait">
                {playerSelections.length > 0 && ( // Only show selection info if something is selected
                  <motion.div
                    key="selection-info"
                    variants={textVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="mt-4 text-base italic text-gray-400"
                  >
                    You've selected {playerSelections.length} cells.
                    {correctLocations.length > 0 && ` (Need to select ${correctLocations.length} in total)`}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 mt-6"
                onClick={submitAnswers}
                {...buttonHoverTap}
              >
                Submit Answers
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default VisualLocationMemory;