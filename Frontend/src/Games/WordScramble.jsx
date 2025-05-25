import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion'; // Import motion and AnimatePresence
import GameNav from './GameNav'; // Assuming GameNav is a separate component

// Words related to everyday objects and activities
const wordBank = [
  "apple", "table", "chair", "clock", "water",
  "house", "bread", "shirt", "phone", "smile",
  "beach", "plant", "brush", "sleep", "happy",
  "music", "paper", "light", "plate", "sunny"
];

function WordScramble() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('idle'); // idle, playing, complete
  const [currentWord, setCurrentWord] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(60); // 60-second timer
  const [feedback, setFeedback] = useState('');
  const [usedWords, setUsedWords] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);

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

  const scrambledWordVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const feedbackVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
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

  useEffect(() => {
    let interval;
    if (gameState === 'playing' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prevTimer => prevTimer - 1);
      }, 1000);
    } else if (timer === 0 && gameState === 'playing') {
      endGame();
    }
    return () => clearInterval(interval);
  }, [gameState, timer]);

  useEffect(() => {
    if (gameState === 'complete' && score > 0 && user?.user_id) {
      saveScore();
    }
  }, [gameState, score, user]);

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
        game_name: 'word-scramble',
        score: score,
        user_name: user.name || 'Unknown User'
      };

      console.log("Saving score:", scoreData);

      //const response = await axios.post('http://localhost:5000/api/games', scoreData);
      const response = await axios.post('https://echomind-6.onrender.com/api/games', scoreData);

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
    setTimer(60);
    setUsedWords([]);
    setFeedback('');
    setGameState('playing');
    setSaveError(null);
    setScoreSaved(false);
    generateNewWord();
  };

  const endGame = () => {
    setGameState('complete');
  };

  const generateNewWord = () => {
    const availableWords = wordBank.filter(word => !usedWords.includes(word));

    if (availableWords.length === 0) {
      endGame();
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableWords.length);
    const word = availableWords[randomIndex];

    const scrambled = scrambleWord(word);

    setCurrentWord(word);
    setScrambledWord(scrambled);
    setUserInput('');
    setFeedback('');
  };

  const scrambleWord = (word) => {
    const wordArray = word.split('');
    let scrambled;

    do {
      scrambled = [...wordArray].sort(() => Math.random() - 0.5).join('');
    } while (scrambled === word);

    return scrambled;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanInput = userInput.trim().toLowerCase();

    if (cleanInput === currentWord) {
      setScore(prevScore => prevScore + 10);
      setFeedback('Correct! +10 points');
      setUsedWords(prev => [...prev, currentWord]);

      setTimeout(() => {
        generateNewWord();
      }, 1000);
    } else {
      setFeedback('Try again!');
    }
  };

  const skipWord = () => {
    setUsedWords(prev => [...prev, currentWord]);
    setScore(prevScore => Math.max(0, prevScore - 2)); // Penalty for skipping
    setFeedback('Word skipped. -2 points');

    setTimeout(() => {
      generateNewWord();
    }, 1000);
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
        <div className="text-lg font-semibold text-purple-400">
          Score: <span className="text-white">{score}</span>
        </div>
      </div>

      <motion.div
        className="max-w-md mx-auto text-center bg-gray-800 bg-opacity-70 p-6 rounded-lg shadow-xl border border-gray-700"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold text-purple-500 mb-6">Word Scramble</h2>

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
              <p className="text-gray-300">Unscramble the letters to form a valid word.</p>
              <p className="text-gray-300">You have 60 seconds to solve as many words as you can!</p>
              <motion.button
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800"
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
              <h3 className="text-2xl font-bold text-purple-500">Time's Up!</h3>
              <p className="text-lg text-gray-300">Your final score: <span className="text-white font-bold">{score}</span></p>
              {scoreSaved && <p className="text-green-400 font-semibold">Score saved successfully!</p>}
              {saveError && <p className="text-red-400 font-semibold">Error: {saveError}</p>}
              <motion.button
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={startGame}
                {...buttonHoverTap}
              >
                Play Again
              </motion.button>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div
              key="playing"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              <div className="text-xl font-bold mb-4 text-red-400">
                Time Remaining: <span className="font-extrabold text-white">{timer}</span> seconds
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={scrambledWord} // Key changes on new word, triggering animation
                  variants={scrambledWordVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-4xl font-extrabold my-4 tracking-widest text-purple-400 uppercase"
                >
                  {scrambledWord}
                </motion.div>
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 max-w-xs w-full mx-auto">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Enter your answer"
                  autoFocus
                  className="w-full p-3 text-lg border-2 border-purple-400 rounded-md outline-none text-center bg-gray-700 text-white placeholder-gray-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-700 transition-all duration-200"
                />
                <div className="flex gap-4 w-full">
                  <motion.button
                    type="submit"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold rounded-md py-2 px-6 text-lg cursor-pointer transition-colors duration-300"
                    {...buttonHoverTap}
                  >
                    Submit
                  </motion.button>
                  <motion.button
                    type="button"
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-md py-2 px-6 text-lg cursor-pointer transition-colors duration-300"
                    onClick={skipWord}
                    {...buttonHoverTap}
                  >
                    Skip
                  </motion.button>
                </div>
              </form>

              <AnimatePresence>
                {feedback && (
                  <motion.div
                    key="feedback"
                    variants={feedbackVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={`mt-4 text-lg font-semibold ${feedback.includes('Correct') ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {feedback}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default WordScramble;