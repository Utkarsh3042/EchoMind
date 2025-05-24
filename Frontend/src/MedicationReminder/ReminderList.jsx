import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, Edit3, Trash2, Clock } from 'react-feather'; // Added Clock for pending status
import { motion, AnimatePresence } from "framer-motion"; // Import motion and AnimatePresence

const ReminderList = ({ refreshTrigger }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingReminder, setEditingReminder] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    instruction: "",
    date_time: "",
    frequency: "daily",
    email: "",
  });

  const fetchReminders = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:5000/api/medication-reminders");
      const result = await response.json();
      
      if (result.success) {
        // Sort reminders: pending first, then by date, then completed/missed
        const sortedReminders = (result.reminders || []).sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          
          if (a.status === 'completed' && b.status === 'missed') return 1;
          if (a.status === 'missed' && b.status === 'completed') return -1;

          // For pending items, sort by date_time ascending
          if (a.status === 'pending' && b.status === 'pending') {
            return new Date(a.date_time) - new Date(b.date_time);
          }
          
          // For completed/missed, sort by date_time descending (most recent first)
          return new Date(b.date_time) - new Date(a.date_time);
        });
        setReminders(sortedReminders);
      } else {
        setError(result.message || "Failed to fetch reminders.");
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
      setError("An error occurred while fetching reminders.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/medication-reminders/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        fetchReminders();
      } else {
        setError(result.message || "Failed to delete reminder.");
      }
    } catch (error) {
      console.error("Error deleting reminder:", error);
      setError("An error occurred while deleting the reminder.");
    }
  };

  const handleComplete = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/medication-reminders/${id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        fetchReminders();
      } else {
        setError(result.message || 'Failed to mark medication as taken');
      }
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      setError('An error occurred while marking medication as taken');
    }
  };

  const startEdit = (reminder) => {
    const dateTime = new Date(reminder.date_time);
    const formattedDateTime = dateTime.toISOString().slice(0, 16);

    setFormData({
      name: reminder.name,
      dosage: reminder.dosage,
      instruction: reminder.instruction,
      date_time: formattedDateTime,
      frequency: reminder.frequency,
      email: reminder.email,
    });
    
    setEditingReminder(reminder._id);
  };

  const cancelEdit = () => {
    setEditingReminder(null);
    setError(""); // Clear error on cancel edit
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const formattedData = {
        ...formData,
        date_time: formData.date_time.replace("T", " ") + ":00",
      };

      const response = await fetch(`http://localhost:5000/api/medication-reminders/${editingReminder}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setEditingReminder(null);
        fetchReminders();
      } else {
        setError(result.message || "Failed to update reminder.");
      }
    } catch (error) {
      console.error("Error updating reminder:", error);
      setError("An error occurred while updating the reminder.");
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  useEffect(() => {
    fetchReminders();
  }, [refreshTrigger]);

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } },
  };

  return (
    <motion.div 
      className="p-6 rounded-lg bg-white bg-opacity-90 shadow-md text-gray-800"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Active Medication Reminders</h2>
      
      {error && (
        <motion.div 
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-sm" 
          role="alert"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </motion.div>
      )}
      
      {loading && reminders.length === 0 ? (
        <div className="text-center p-4">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="mt-4 text-gray-600">Loading reminders...</p>
        </div>
      ) : reminders.length === 0 ? (
        <p className="text-gray-500 italic text-center py-4">No reminders found. Create your first reminder using the form.</p>
      ) : (
        <div className="space-y-4">
          <AnimatePresence> {/* Enable exit animations */}
            {reminders.map((reminder) => (
              <motion.div 
                key={reminder._id} 
                className={`p-4 border rounded-lg shadow-sm flex flex-col transition-all duration-300 ease-in-out 
                  ${reminder.status === 'completed' ? 'bg-green-50 border-green-200 opacity-80' : 
                    reminder.status === 'missed' ? 'bg-red-50 border-red-200 opacity-80' : 
                    'bg-white border-gray-200 hover:shadow-md'
                  }`}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit" // Apply exit animation
              >
                {editingReminder === reminder._id ? (
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div className="flex flex-col">
                      <label htmlFor={`edit-name-${reminder._id}`} className="text-sm font-semibold text-gray-700 mb-1">Medication Name:</label>
                      <input 
                        type="text" 
                        name="name" 
                        id={`edit-name-${reminder._id}`}
                        value={formData.name} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor={`edit-dosage-${reminder._id}`} className="text-sm font-semibold text-gray-700 mb-1">Dosage:</label>
                      <input 
                        type="text" 
                        name="dosage" 
                        id={`edit-dosage-${reminder._id}`}
                        value={formData.dosage} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor={`edit-instruction-${reminder._id}`} className="text-sm font-semibold text-gray-700 mb-1">Instructions:</label>
                      <input 
                        type="text" 
                        name="instruction" 
                        id={`edit-instruction-${reminder._id}`}
                        value={formData.instruction} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor={`edit-datetime-${reminder._id}`} className="text-sm font-semibold text-gray-700 mb-1">Start Date & Time:</label>
                      <input 
                        type="datetime-local" 
                        name="date_time" 
                        id={`edit-datetime-${reminder._id}`}
                        value={formData.date_time} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor={`edit-frequency-${reminder._id}`} className="text-sm font-semibold text-gray-700 mb-1">Frequency:</label>
                      <div className="relative">
                        <select 
                          name="frequency" 
                          id={`edit-frequency-${reminder._id}`}
                          value={formData.frequency} 
                          onChange={handleChange}
                          className="block appearance-none w-full bg-white border border-gray-300 text-gray-800 py-2 px-3 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor={`edit-email-${reminder._id}`} className="text-sm font-semibold text-gray-700 mb-1">Email:</label>
                      <input 
                        type="email" 
                        name="email" 
                        id={`edit-email-${reminder._id}`}
                        value={formData.email} 
                        onChange={handleChange} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm" 
                        required 
                      />
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                      <motion.button 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Save
                      </motion.button>
                      <motion.button 
                        type="button" 
                        onClick={cancelEdit} 
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-3 flex-grow"> {/* flex-grow to take available space */}
                        <div className="mt-0.5 flex-shrink-0">
                          {reminder.status === 'completed' ? (
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          ) : reminder.status === 'missed' ? (
                            <XCircle className="w-6 h-6 text-red-500" />
                          ) : (
                            <motion.button
                              onClick={() => handleComplete(reminder._id)}
                              className="w-6 h-6 border-2 border-gray-400 rounded-full flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors duration-200"
                              title="Mark as taken"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Clock className="w-4 h-4" /> {/* Clock icon for pending */}
                            </motion.button>
                          )}
                        </div>
                        <div className="flex-grow">
                          <h3 className={`text-lg font-semibold text-gray-800 ${
                            reminder.status === 'completed' ? 'line-through text-gray-500' : ''
                          }`}>
                            {reminder.name}
                          </h3>
                          <p className="text-gray-600 text-sm">{reminder.dosage}</p>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-gray-500 mt-1 flex-shrink-0">
                        {reminder.frequency.charAt(0).toUpperCase() + reminder.frequency.slice(1)}
                      </div>
                    </div>
                    
                    <p className={`my-2 text-gray-700 text-sm ${
                      reminder.status === 'completed' ? 'line-through text-gray-500' : ''
                    }`}>
                      {reminder.instruction}
                    </p>
                    
                    <div className="flex flex-wrap justify-between items-center mt-3 text-xs text-gray-500">
                      <p className="mr-2"> {/* Added mr-2 for spacing */}
                        Next: <span className="font-medium text-gray-700">{formatDate(reminder.date_time)}</span>
                      </p>
                      <p className="text-gray-600">
                        Email: <span className="font-medium">{reminder.email}</span>
                      </p>
                    </div>
                    
                    {reminder.status !== 'completed' && ( // Only show buttons if not completed
                      <div className="mt-4 flex space-x-3 justify-end"> {/* Increased space-x */}
                        <motion.button 
                          onClick={() => startEdit(reminder)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200 flex items-center"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Edit3 className="w-4 h-4 mr-1" /> Edit
                        </motion.button>
                        <motion.button 
                          onClick={() => handleDelete(reminder._id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors duration-200 flex items-center"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </motion.button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default ReminderList;