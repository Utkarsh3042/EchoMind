import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import "./index.css";
import Login from "./Login";
import Signup from "./Signup";
import SimonSays from "./Games/SimonSays";
import VisualLocationMemory from "./Games/VisualLocationMemory";
import WordScramble from "./Games/WordScramble";
import PictureMatch from "./Games/PictureMatch";
import GameHome from "./Games/GameHome";
import Dashboard from "./Dashboard/dashboard";
import SosButton from "./Sos/SosButton";
import Contacts from "./Contacts/Contacts.jsx";
import Summary from "./Summary/Summary.jsx";
import Combined from "./MedicationReminder/Combined.jsx";
import GeofenceGuardian from "./GeofenceGuardian/GeofenceGuardian.jsx";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import "./i18n"; // Import the i18n configuration

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking
  const { t } = useTranslation();

  useEffect(() => {
    const token = localStorage.getItem("user");
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    // Show loading while checking auth
    return <div className="loading-screen">{t("loading")}</div>;
  }

  return (
    <div className="app">
      {isAuthenticated && <LanguageSwitcher />}
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/login"
          element={<Login onLogin={() => setIsAuthenticated(true)} />}
        />
        <Route
          path="/signup"
          element={<Signup onSignup={() => setIsAuthenticated(true)} />}
        />

        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
        />

        <Route
          path="/contacts"
          element={isAuthenticated ? <Contacts /> : <Navigate to="/login" />}
        />

        <Route
          path="/summary"
          element={isAuthenticated ? <Summary /> : <Navigate to="/login" />}
        />
        <Route
          path="/medication-reminder"
          element={isAuthenticated ? (
           <Combined/>
          ) : (
            <Navigate to="/login" />
          )}
        />
        <Route
          path="/sos"
          element={isAuthenticated ? <SosButton /> : <Navigate to="/login" />}
        />

        <Route
          path="/games"
          element={isAuthenticated ? <GameHome /> : <Navigate to="/login" />}
        />
        <Route
          path="/games/simon-says"
          element={isAuthenticated ? <SimonSays /> : <Navigate to="/login" />}
        />
        <Route
          path="/games/picture-match"
          element={
            isAuthenticated ? <PictureMatch /> : <Navigate to="/login" />
          }
        />
         <Route
          path="/geofence-guardian"
          element={isAuthenticated ? <GeofenceGuardian /> : <Navigate to="/login" />}
        />
        <Route
          path="/games/word-scramble"
          element={
            isAuthenticated ? <WordScramble /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/games/visual-location"
          element={
            isAuthenticated ? (
              <VisualLocationMemory />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </div>
  );
}

export default App;