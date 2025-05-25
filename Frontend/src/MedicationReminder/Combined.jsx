import React, { useState } from "react";
import ReminderList from "./ReminderList";
import MedicationReminderForm from "./MedicationReminderForm";
import NavBack from "../NavBack";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next"; // Add this import

const Combined = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { t } = useTranslation(); // Add this hook initialization

  const refreshReminders = () => {
    // Trigger a refresh of the reminders list without reloading the page
    setRefreshTrigger((prev) => prev + 1);
  };

  // Framer Motion variants for animations
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delayChildren: 0.2,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-800 via-purple-700 to-purple-900 text-white p-4 sm:p-6 lg:p-8 font-sans">
      <NavBack />

      <motion.h1
        className="text-3xl sm:text-4xl font-bold mb-8 text-center text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {t('medicationReminderDashboard')} {/* Replace with translation function */}
      </motion.h1>

      <motion.div
        className="flex flex-col md:flex-row gap-6 md:gap-8 max-w-6xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Left Column for the Form */}
        <motion.div
          className="w-full md:w-1/2 p-4 md:p-6 bg-green-500 bg-opacity-70 rounded-2xl shadow-lg" // Adjusted color and opacity
          variants={itemVariants}
        >
          <MedicationReminderForm onReminderCreated={refreshReminders} />
        </motion.div>

        {/* Right Column for the Reminder List */}
        <motion.div
          className="w-full md:w-1/2 p-4 md:p-6 bg-purple-700 bg-opacity-50 rounded-2xl shadow-lg" // Adjusted color and opacity
          variants={itemVariants}
        >
          <ReminderList refreshTrigger={refreshTrigger} />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Combined;