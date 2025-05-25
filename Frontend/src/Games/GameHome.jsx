import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GameNav from './GameNav';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import React from 'react';
import { useTranslation } from 'react-i18next'; // Import translation hook

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function GameHome() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState([]);
  const [chartType, setChartType] = useState('line'); // Toggle between line and bar charts
  const { t } = useTranslation(); // Initialize translation hook

  // Load user data from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    console.log('User data from localStorage:', userData); // Keep this essential log

    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log('Parsed user data:', {
          id: parsedUser.user_id,
          name: parsedUser.name
        });

        if (!parsedUser.user_id) {
          console.error('No valid user_id found in user data');
          return;
        }

        setUser({
          ...parsedUser,
          _id: parsedUser.user_id
        });
      } catch (err) {
        console.error('Error parsing user data:', err);
      }
    } else {
      console.log('No user data found in localStorage');
    }
    setLoading(false);
  }, []);

  // Fetch game data
  useEffect(() => {
    const fetchGameData = async () => {
      if (user && user._id) {
        try {
          console.log('Fetching data for user ID:', user._id);

          // const response = await fetch(`http://localhost:5000/api/games/${user._id}`, {
          const response = await fetch(`https://echomind-6.onrender.com/api/games/${user._id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
          }

          // Just log the raw data from backend
          const result = await response.json();
          console.log('======= BACKEND DATA ========');
          console.log('Games from backend:', result.games);
          console.log('======= END BACKEND DATA ========');

          // Process the data without logging
          const validGames = result.games.filter(game =>
            game &&
            typeof game.score === 'number' &&
            game.game_name &&
            game.timestamp
          );

          if (validGames.length === 0) {
            setGameData([]);
            return;
          }

          const sortedGames = validGames.sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
          );

          setGameData(sortedGames);
        } catch (err) {
          console.error('Failed to fetch game data:', err);
          setGameData([]);
        }
      }
    };

    fetchGameData();
  }, [user]);

  // Generate sample data if no real data is available (for demonstration)
  const getSampleData = () => {
    const today = new Date();
    const sampleData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Generate sample scores for each game
      sampleData.push(
        {
          game_name: 'simon-says',
          score: Math.floor(Math.random() * 50) + 10,
          timestamp: date.toISOString()
        },
        {
          game_name: 'word-scramble',
          score: Math.floor(Math.random() * 80) + 20,
          timestamp: date.toISOString()
        },
        {
          game_name: 'visual-location-memory',
          score: Math.floor(Math.random() * 60) + 15,
          timestamp: date.toISOString()
        },
        {
          game_name: 'picture-match',
          score: Math.floor(Math.random() * 70) + 25,
          timestamp: date.toISOString()
        }
      );
    }

    return sampleData;
  };

  // Use real data if available, otherwise use sample data
  const displayData = gameData.length > 0 ? gameData : getSampleData();

  // Calculate average scores for each game
  const getAverageScores = () => {
    const gameTypes = ['simon-says', 'word-scramble', 'visual-location-memory', 'picture-match'];
    const averages = {};

    gameTypes.forEach(gameType => {
      const scores = displayData
        .filter(game => game.game_name === gameType)
        .map(game => game.score);

      if (scores.length > 0) {
        averages[gameType] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      } else {
        averages[gameType] = 0;
      }
    });

    return averages;
  };

  // Prepare data for line chart (performance over time)
  const getLineChartData = () => {
    const dates = [...new Set(displayData.map(game =>
      new Date(game.timestamp).toLocaleDateString()
    ))].sort((a, b) => new Date(a) - new Date(b));

    const chartData = {
      labels: dates,
      datasets: [
        {
          label: 'Simon Says',
          data: dates.map(date => {
            const dayGames = displayData.filter(game =>
              game.game_name === 'simon-says' &&
              new Date(game.timestamp).toLocaleDateString() === date
            );
            return dayGames.length > 0 ?
              Math.round(dayGames.reduce((sum, game) => sum + game.score, 0) / dayGames.length) :
              null;
          }),
          borderColor: 'rgb(255, 99, 132)', // Tailwind equivalent: red-500 (approx)
          backgroundColor: 'rgba(255, 99, 132, 0.2)', // Tailwind equivalent: red-500/20 (approx)
          tension: 0.4,
          spanGaps: true
        },
        {
          label: 'Word Scramble',
          data: dates.map(date => {
            const dayGames = displayData.filter(game =>
              game.game_name === 'word-scramble' &&
              new Date(game.timestamp).toLocaleDateString() === date
            );
            return dayGames.length > 0 ?
              Math.round(dayGames.reduce((sum, game) => sum + game.score, 0) / dayGames.length) :
              null;
          }),
          borderColor: 'rgb(75, 192, 192)', // Tailwind equivalent: teal-500 (approx)
          backgroundColor: 'rgba(75, 192, 192, 0.2)', // Tailwind equivalent: teal-500/20 (approx)
          tension: 0.4,
          spanGaps: true
        },
        {
          label: 'Visual Location Memory',
          data: dates.map(date => {
            const dayGames = displayData.filter(game =>
              game.game_name === 'visual-location-memory' &&
              new Date(game.timestamp).toLocaleDateString() === date
            );
            return dayGames.length > 0 ?
              Math.round(dayGames.reduce((sum, game) => sum + game.score, 0) / dayGames.length) :
              null;
          }),
          borderColor: 'rgb(53, 162, 235)', // Tailwind equivalent: blue-500 (approx)
          backgroundColor: 'rgba(53, 162, 235, 0.2)', // Tailwind equivalent: blue-500/20 (approx)
          tension: 0.4,
          spanGaps: true
        },
        {
          label: 'Picture Match',
          data: dates.map(date => {
            const dayGames = displayData.filter(game =>
              game.game_name === 'picture-match' &&
              new Date(game.timestamp).toLocaleDateString() === date
            );
            return dayGames.length > 0 ?
              Math.round(dayGames.reduce((sum, game) => sum + game.score, 0) / dayGames.length) :
              null;
          }),
          borderColor: 'rgb(255, 159, 64)', // Tailwind equivalent: orange-400 (approx)
          backgroundColor: 'rgba(255, 159, 64, 0.2)', // Tailwind equivalent: orange-400/20 (approx)
          tension: 0.4,
          spanGaps: true
        }
      ]
    };

    return chartData;
  };

  // Prepare data for bar chart (average performance comparison)
  const getBarChartData = () => {
    const averages = getAverageScores();

    return {
      labels: ['Simon Says', 'Word Scramble', 'Visual Location Memory', 'Picture Match'],
      datasets: [
        {
          label: 'Average Score',
          data: [
            averages['simon-says'],
            averages['word-scramble'],
            averages['visual-location-memory'],
            averages['picture-match']
          ],
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)', // Tailwind equivalent: bg-red-500/80 (approx)
            'rgba(75, 192, 192, 0.8)', // Tailwind equivalent: bg-teal-500/80 (approx)
            'rgba(53, 162, 235, 0.8)', // Tailwind equivalent: bg-blue-500/80 (approx)
            'rgba(255, 159, 64, 0.8)' // Tailwind equivalent: bg-orange-400/80 (approx)
          ],
          borderColor: [
            'rgb(255, 99, 132)', // Tailwind equivalent: border-red-500 (approx)
            'rgb(75, 192, 192)', // Tailwind equivalent: border-teal-500 (approx)
            'rgb(53, 162, 235)', // Tailwind equivalent: border-blue-500 (approx)
            'rgb(255, 159, 64)' // Tailwind equivalent: border-orange-400 (approx)
          ],
          borderWidth: 2
        }
      ]
    };
  };

  // Chart options
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
            color: '#333333', // Dark gray for legend text for readability on white background
        }
      },
      title: {
        display: true,
        font: {
          size: 16,
          weight: 'bold',
          color: '#333333' // Dark gray for title text
        },
        color: '#333333' // Fallback for older Chart.js versions or specific setups
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('score'),
          color: '#333333' // Dark gray for Y-axis title
        },
        ticks: {
            color: '#333333' // Dark gray for Y-axis ticks
        },
        grid: {
            color: 'rgba(0, 0, 0, 0.1)' // Light gray grid lines for contrast
        }
      },
      x: {
        title: {
          display: true,
          text: t('date'),
          color: '#333333' // Dark gray for X-axis title
        },
        ticks: {
            color: '#333333' // Dark gray for X-axis ticks
        },
        grid: {
            color: 'rgba(0, 0, 0, 0.1)' // Light gray grid lines for contrast
        }
      }
    },
  };

  const lineChartOptions = {
    ...commonChartOptions,
    plugins: {
      ...commonChartOptions.plugins,
      title: {
        ...commonChartOptions.plugins.title,
        text: t('gamePerformanceOverTime'),
      }
    },
    scales: {
      ...commonChartOptions.scales,
      y: {
        ...commonChartOptions.scales.y,
        text: 'Score',
      },
      x: {
        ...commonChartOptions.scales.x,
        text: 'Date',
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    }
  };

  const barChartOptions = {
    ...commonChartOptions,
    plugins: {
      ...commonChartOptions.plugins,
      legend: {
        display: false
      },
      title: {
        ...commonChartOptions.plugins.title,
        text: t('averagePerformanceComparison'),
      }
    },
    scales: {
      ...commonChartOptions.scales,
      y: {
        ...commonChartOptions.scales.y,
        text: 'Average Score',
      },
      x: {
        ...commonChartOptions.scales.x,
        title: {
          display: false, // No title for X-axis on bar chart, labels are self-explanatory
        }
      }
    }
  };


  // Get performance statistics
  const getPerformanceStats = () => {
    if (displayData.length === 0) return null;

    const totalGames = displayData.length;
    const averages = getAverageScores();
    const overallAverage = Math.round(
      Object.values(averages).reduce((a, b) => a + b, 0) / Object.values(averages).length
    );

    // Find best performing game based on average score
    let bestGameName = '';
    let maxAvgScore = -1;
    for (const gameName in averages) {
        if (averages[gameName] > maxAvgScore) {
            maxAvgScore = averages[gameName];
            bestGameName = gameName;
        }
    }

    // Find most played game
    const gamePlayCounts = displayData.reduce((acc, game) => {
        acc[game.game_name] = (acc[game.game_name] || 0) + 1;
        return acc;
    }, {});

    let mostPlayedGameName = '';
    let maxPlayCount = -1;
    for (const gameName in gamePlayCounts) {
        if (gamePlayCounts[gameName] > maxPlayCount) {
            maxPlayCount = gamePlayCounts[gameName];
            mostPlayedGameName = gameName;
        }
    }


    return {
      totalGames,
      overallAverage,
      bestGame: bestGameName,
      mostPlayedGame: mostPlayedGameName
    };
  };

  const stats = getPerformanceStats();

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-5 bg-gray-800 shadow-xl sm:mt-5">
      <GameNav user={user} />
      <div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo-400 text-center mb-6 sm:mb-8">{t('echoMindGames')}</h2>

          {/* Performance Dashboard */}
          <div className="bg-gray-700 p-4 sm:p-6 rounded-lg shadow-md mb-8 sm:mb-10">
            {/* Chart Controls */}
            <div className="flex flex-col sm:flex-row justify-center mb-4 sm:mb-5 space-y-2 sm:space-y-0 sm:space-x-4">
              <button
                className={`w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-2 rounded-md text-base sm:text-lg font-semibold transition-colors duration-300
                  ${chartType === 'line' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                onClick={() => setChartType('line')}
              >
                {t('performanceOverTime')}
              </button>
              <button
                className={`w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-2 rounded-md text-base sm:text-lg font-semibold transition-colors duration-300
                  ${chartType === 'bar' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                onClick={() => setChartType('bar')}
              >
                {t('averageComparison')}
              </button>
            </div>

            {/* Chart Container - Add height style to ensure visibility */}
            <div className="relative h-[300px] sm:h-[400px] w-full bg-white rounded-lg p-2 sm:p-3 shadow-inner">
              {displayData && displayData.length > 0 ? (
                chartType === 'line' ? (
                  <Line
                    options={lineChartOptions}
                    data={getLineChartData()}
                  />
                ) : (
                  <Bar
                    options={barChartOptions}
                    data={getBarChartData()}
                  />
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-base sm:text-xl font-medium">
                  {loading ? t('loadingGameData') : t('playGamesToSeeChart')}
                </div>
              )}
            </div>

            {/* Performance Statistics */}
            {stats && (
              <div className="bg-gray-700 p-4 sm:p-6 rounded-lg shadow-md mt-6 sm:mt-8">
                <h3 className="text-2xl sm:text-3xl font-bold text-indigo-400 text-center mb-4 sm:mb-6">{t('performanceSummary')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-center">
                  <div className="bg-gray-800 p-3 sm:p-5 rounded-lg border border-gray-600 shadow-sm">
                    <div className="text-3xl sm:text-5xl font-extrabold text-green-400 mb-1 sm:mb-2">{stats.totalGames}</div>
                    <div className="text-sm sm:text-xl text-gray-300">{t('totalGamesPlayed')}</div>
                  </div>
                  <div className="bg-gray-800 p-3 sm:p-5 rounded-lg border border-gray-600 shadow-sm">
                    <div className="text-3xl sm:text-5xl font-extrabold text-yellow-400 mb-1 sm:mb-2">{stats.overallAverage}</div>
                    <div className="text-sm sm:text-xl text-gray-300">{t('overallAverageScore')}</div>
                  </div>
                  <div className="bg-gray-800 p-3 sm:p-5 rounded-lg border border-gray-600 shadow-sm">
                    <div className="text-xl sm:text-3xl font-bold text-blue-400 mb-1 sm:mb-2">
                      {t(stats.bestGame.replace(/-/g, ''))}
                    </div>
                    <div className="text-sm sm:text-xl text-gray-300">{t('bestPerformingGame')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Games Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mt-8 sm:mt-10">
            <div className="bg-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="p-4 sm:p-6 text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-emerald-400 mb-2 sm:mb-3">{t('simonSays')}</h3>
                <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-5">{t('simonSaysDesc')}</p>
                <Link to="/games/simon-says" className="inline-block bg-emerald-600 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-md font-semibold hover:bg-emerald-700 transition-colors duration-300 text-sm sm:text-base">{t('play')}</Link>
              </div>
            </div>

            <div className="bg-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="p-4 sm:p-6 text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-yellow-400 mb-2 sm:mb-3">{t('wordScramble')}</h3>
                <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-5">{t('wordScrambleDesc')}</p>
                <Link to="/games/word-scramble" className="inline-block bg-yellow-600 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-md font-semibold hover:bg-yellow-700 transition-colors duration-300 text-sm sm:text-base">{t('play')}</Link>
              </div>
            </div>

            <div className="bg-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="p-4 sm:p-6 text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-blue-400 mb-2 sm:mb-3">{t('visualLocationMemory')}</h3>
                <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-5">{t('visualLocationMemoryDesc')}</p>
                <Link to="/games/visual-location" className="inline-block bg-blue-600 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors duration-300 text-sm sm:text-base">{t('play')}</Link>
              </div>
            </div>

            <div className="bg-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="p-4 sm:p-6 text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-red-400 mb-2 sm:mb-3">{t('pictureMatch')}</h3>
                <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-5">{t('pictureMatchDesc')}</p>
                <Link to="/games/picture-match" className="inline-block bg-red-600 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-md font-semibold hover:bg-red-700 transition-colors duration-300 text-sm sm:text-base">{t('play')}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameHome;