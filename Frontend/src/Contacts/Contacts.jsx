import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion"; // Import motion and AnimatePresence
import NavBack from "../NavBack";
import { useTranslation } from "react-i18next"; // Import translation hook

// Update the base URL to match your backend
// const API_BASE_URL = "http://localhost:5000";
const API_BASE_URL = "https://echomind-6.onrender.com";

function Contacts() {
  const { t } = useTranslation(); // Initialize translation hook
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [user, setUser] = useState(null);

  // Default conversation data
  const defaultConversationData = [
    { "text": t("hello"), "timestamp": "2025-03-20T09:30:00.000000" },
    { "text": t("hi"), "timestamp": "2025-03-20T09:30:15.000000" },
  ];

  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    isEmergency: false,
    photo_url: "",
    conversation_data: defaultConversationData
  });

  const [editContact, setEditContact] = useState({
    name: "",
    email: "",
    phone: "",
    isEmergency: false,
    photo_url: "",
    conversation_data: []
  });

  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [externalNotificationStatus, setExternalNotificationStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get user from localStorage
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        setUser(userData);
      } catch (err) {
        console.error("Error parsing user data:", err);
        setError(t("errorLoadingUserData"));
      }
    } else {
      // Redirect to login if no user found
      navigate("/login");
    }
  }, [navigate, t]);

  useEffect(() => {
    if (user?.user_id) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/contacts/${user.user_id}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${t("serverRespondedWithStatus")}: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        setContacts(data.contacts);
      } else {
        setError(t("failedToLoadContacts"));
      }
    } catch (err) {
      setError(t("errorFetchingContacts") + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e, isEdit = false) => {
    const { name, value, type, checked } = e.target;
    const contactToUpdate = isEdit ? editContact : newContact;
    const setContactFunction = isEdit ? setEditContact : setNewContact;

    setContactFunction({
      ...contactToUpdate,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const uploadImageToBackend = async (file) => {
    try {
      setUploadingImage(true);

      // Create form data for the image upload
      const formData = new FormData();
      formData.append("image", file);

      // Upload to our backend, which will handle the ImgBB upload
      const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
        method: "POST",
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${t("uploadError")}: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        return data.imageUrl;
      } else {
        throw new Error(data.error || t("imageUploadFailed"));
      }
    } catch (err) {
      console.error(t("imageUploadError"), err);
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Create temporary object URL for preview
      const previewUrl = URL.createObjectURL(file);

      if (isEdit) {
        setEditContact({
          ...editContact,
          photo_url: previewUrl,
          file: file
        });
      } else {
        setNewContact({
          ...newContact,
          photo_url: previewUrl,
          file: file
        });
      }
    } catch (err) {
      console.error(t("errorCreatingPreview"), err);
      setError(t("errorCreatingImagePreview"));
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();

    // Validate input
    if (!newContact.name || !newContact.name.trim()) {
      setError(t("contactNameRequired"));
      return;
    }

    // Basic email validation
    if (newContact.email && !validateEmail(newContact.email)) {
      setError(t("enterValidEmail"));
      return;
    }

    try {
      setLoading(true);
      setError("");
      setExternalNotificationStatus(null);

      // Upload the image if provided
      let imageUrl = "";
      if (newContact.file) {
        try {
          imageUrl = await uploadImageToBackend(newContact.file);
          console.log(t("imageUploadedSuccessfully"), imageUrl);
        } catch (uploadError) {
          console.error(t("imageUploadFailed"), uploadError);
          setError(t("failedToUploadImage"));
        }
      }

      // Create contact data
      const contactData = {
        name: newContact.name.trim(),
        email: newContact.email || "",
        phone: newContact.phone || "",
        isEmergency: newContact.isEmergency || false,
        photo_url: imageUrl,
        user_id: user.user_id,
        user_name: user.name || t("unknown"),
        conversation_data: defaultConversationData
      };

      console.log(t("sendingContactDataToBackend"), contactData);

      // First, add to your main contacts API
      const response = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        throw new Error(`${t("serverRespondedWithStatus")}: ${response.status}`);
      }

      const data = await response.json();
      console.log(t("backendResponse"), data);

      if (data.success) {
        // Now make the POST request to the /add endpoint (external service)
        try {
          const addResponse = await fetch(`https://slzvr7mc-8000.inc1.devtunnels.ms/add`, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: contactData.name,
              photo_url: contactData.photo_url
            }),
          });

          if (addResponse.ok) {
            const addData = await addResponse.json();
            console.log(t("addEndpointResponse"), addData);
            setExternalNotificationStatus('succeeded');
          } else {
            console.error(t("addEndpointFailed"), addResponse.status);
            setExternalNotificationStatus('failed');
          }
        } catch (addError) {
          console.error(t("errorCallingAddEndpoint"), addError);
          setExternalNotificationStatus('failed');
        }

        // Refresh contacts list
        await fetchContacts();

        // Close modal and reset form
        setShowAddModal(false);
        setNewContact({
          name: "",
          email: "",
          phone: "",
          isEmergency: false,
          photo_url: "",
          conversation_data: defaultConversationData
        });

        // Show notification status for 5 seconds
        setTimeout(() => {
          setExternalNotificationStatus(null);
        }, 5000);

        setError("");

      } else {
        setError(data.error || t("failedToAddContact"));
      }
    } catch (err) {
      console.error(t("errorAddingContact"), err);
      setError(t("errorOccurredAddingContact") + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditContact = async (e) => {
    e.preventDefault();

    // Validate input
    if (!editContact.name) {
      setError(t("contactNameRequired"));
      return;
    }

    // Basic email validation
    if (editContact.email && !validateEmail(editContact.email)) {
      setError(t("enterValidEmail"));
      return;
    }

    try {
      setLoading(true);

      // Create a copy of the contact data to update
      const contactData = { ...editContact };

      // Upload the new image if provided
      if (editContact.file) {
        const imageUrl = await uploadImageToBackend(editContact.file);
        contactData.photo_url = imageUrl;
      }

      // Remove file property before sending to backend
      delete contactData.file;

      const response = await fetch(`${API_BASE_URL}/api/contacts/${editContact._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        throw new Error(`${t("serverRespondedWithStatus")}: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        fetchContacts();
        setShowEditModal(false);
        setError("");
      } else {
        setError(data.error || t("failedToUpdateContact"));
      }
    } catch (err) {
      setError(t("errorOccurredUpdatingContact") + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  const handleDeleteContact = async (contactId) => {
    if (window.confirm(t("confirmDeleteContact"))) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error(`${t("serverRespondedWithStatus")}: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          fetchContacts();
        } else {
          setError(data.error || t("failedToDeleteContact"));
        }
      } catch (err) {
        setError(t("errorOccurredDeletingContact"));
        console.error(err);
      }
    }
  };

  const handleViewConversation = (contact) => {
    setSelectedContact(contact);
    setShowConversationModal(true);
  };

  const handleEditButtonClick = (contact) => {
    setEditContact({
      ...contact,
    });
    setShowEditModal(true);
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (err) {
      console.error(t("errorFormattingTimestamp"), err);
      return timestamp;
    }
  };

  // Framer Motion Variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeIn" } },
  };

  const cardVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
    whileHover: { scale: 1.03, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" },
    whileTap: { scale: 0.98 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.75 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.75, transition: { duration: 0.2, ease: "easeIn" } },
  };

  const buttonHoverTap = {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 }
  };

  const notificationVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
  };

  // If user is not loaded yet, show loading
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <svg className="animate-spin h-8 w-8 text-white mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {t("loadingUserData")}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-gray-100 py-8 px-4 sm:px-6 lg:px-8 relative"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <NavBack className="absolute top-4 left-4 z-10 text-white" />

        <motion.div
          className="contacts-container w-full max-w-4xl mx-auto bg-gray-800 bg-opacity-80 rounded-xl shadow-2xl p-6 sm:p-8 relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-red-500 mb-8 tracking-wide">{t("myContacts")}</h1>

          <AnimatePresence>
            {error && (
              <motion.div
                className="bg-red-700 text-white p-3 rounded-lg text-center mb-6"
                variants={notificationVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {error}
              </motion.div>
            )}
            {externalNotificationStatus && (
              <motion.div
                className={`p-3 rounded-lg text-center mb-6 ${externalNotificationStatus === 'succeeded' ? 'bg-green-700 text-white' : 'bg-yellow-700 text-white'}`}
                variants={notificationVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {t("externalNotification")} {externalNotificationStatus === 'succeeded' ? t("succeeded") : t("failed")}
                {externalNotificationStatus === 'succeeded' && t("contactAddedToExternalService")}
                {externalNotificationStatus === 'failed' && t("failedToNotifyExternalService")}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md mb-8 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => setShowAddModal(true)}
            {...buttonHoverTap}
          >
            <span className="text-2xl mr-2">+</span> {t("addNewContact")}
          </motion.button>

          {loading ? (
            <div className="flex justify-center items-center py-10">
              <svg className="animate-spin h-8 w-8 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lg text-gray-400">{t("loadingContacts")}</p>
            </div>
          ) : (
            <div className="contacts-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {contacts.length === 0 ? (
                <p className="no-contacts text-center text-lg text-gray-400 col-span-full py-10">{t("noContactsFound")}</p>
              ) : (
                contacts.map((contact) => (
                  <motion.div
                    className="contact-card bg-gray-700 rounded-lg shadow-lg overflow-hidden flex flex-col items-center p-6 relative"
                    key={contact._id}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                    whileHover="whileHover"
                    whileTap="whileTap"
                  >
                    <div className="contact-photo mb-4 relative">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} alt={contact.name} className="w-24 h-24 rounded-full object-cover border-4 border-blue-500" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-4xl font-bold border-4 border-blue-500">
                          {contact.name.charAt(0)}
                        </div>
                      )}
                      {contact.isEmergency && (
                        <span className="emergency-badge absolute top-0 right-0 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full transform translate-x-1/4 -translate-y-1/4 shadow-md">
                          {t("emergency")}
                        </span>
                      )}
                    </div>
                    <div className="contact-info text-center flex-grow">
                      <h3 className="text-xl font-bold text-white mb-2">{contact.name}</h3>
                      {contact.email && <p className="text-gray-300 text-sm break-all"><strong>{t("email")}:</strong> {contact.email}</p>}
                      {contact.phone && <p className="text-gray-300 text-sm"><strong>{t("phone")}:</strong> {contact.phone}</p>}
                      {contact.user_name && (
                        <p className="added-by text-gray-400 text-xs mt-2">{t("addedBy")}: {contact.user_name}</p>
                      )}
                    </div>
                    <div className="contact-actions flex space-x-2 mt-4">
                      <motion.button
                        className="edit-btn p-2 bg-yellow-500 hover:bg-yellow-600 rounded-full text-white transition-colors duration-200"
                        onClick={() => handleEditButtonClick(contact)}
                        title={t("editContact")}
                        {...buttonHoverTap}
                      >
                        <i className="edit-icon">✏️</i>
                      </motion.button>
                      <motion.button
                        className="view-conversation-btn p-2 bg-purple-600 hover:bg-purple-700 rounded-full text-white transition-colors duration-200"
                        onClick={() => handleViewConversation(contact)}
                        title={t("viewConversation")}
                        {...buttonHoverTap}
                      >
                        <i className="conversation-icon">💬</i>
                      </motion.button>
                      <motion.button
                        className="delete-btn p-2 bg-red-600 hover:bg-red-700 rounded-full text-white text-lg font-bold transition-colors duration-200"
                        onClick={() => handleDeleteContact(contact._id)}
                        title={t("deleteContact")}
                        {...buttonHoverTap}
                      >
                        ×
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </motion.div>

        {/* Add Contact Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              className="modal-overlay fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="modal bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-700"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="modal-header flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">{t("addNewContact")}</h2>
                  <motion.button
                    className="close-btn text-gray-400 hover:text-white text-3xl leading-none"
                    onClick={() => setShowAddModal(false)}
                    {...buttonHoverTap}
                  >
                    &times;
                  </motion.button>
                </div>

                <form onSubmit={handleAddContact}>
                  <div className="form-group mb-4">
                    <label htmlFor="name" className="block text-gray-300 text-sm font-semibold mb-2">{t("name")} *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={newContact.name}
                      onChange={(e) => handleInputChange(e, false)}
                      placeholder={t("contactName")}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="form-group mb-4">
                    <label htmlFor="email" className="block text-gray-300 text-sm font-semibold mb-2">{t("email")}</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={newContact.email}
                      onChange={(e) => handleInputChange(e, false)}
                      placeholder={t("emailAddress")}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="form-group mb-4">
                    <label htmlFor="phone" className="block text-gray-300 text-sm font-semibold mb-2">{t("phoneNumber")}</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={newContact.phone}
                      onChange={(e) => handleInputChange(e, false)}
                      placeholder={t("phoneNumber")}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="form-group checkbox-group mb-4 flex items-center">
                    <input
                      type="checkbox"
                      id="isEmergency"
                      name="isEmergency"
                      checked={newContact.isEmergency}
                      onChange={(e) => handleInputChange(e, false)}
                      className="mr-2 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isEmergency" className="text-gray-300 text-sm font-semibold">{t("emergencyContact")}</label>
                  </div>

                  <div className="form-group mb-6">
                    <label htmlFor="photo" className="block text-gray-300 text-sm font-semibold mb-2">{t("photo")}</label>
                    <input
                      type="file"
                      id="photo"
                      name="photo"
                      onChange={(e) => handleFileChange(e, false)}
                      accept="image/*"
                      className="w-full text-gray-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 transition-all duration-300"
                    />
                    {newContact.photo_url && (
                      <div className="preview-photo mt-4">
                        <img src={newContact.photo_url} alt={t("preview")} className="max-w-[100px] max-h-[100px] rounded-full object-cover mx-auto" />
                      </div>
                    )}
                  </div>

                  <div className="form-actions flex justify-end space-x-4">
                    <motion.button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      disabled={uploadingImage}
                      className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      {...buttonHoverTap}
                    >
                      {t("cancel")}
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={uploadingImage || loading}
                      {...buttonHoverTap}
                    >
                      {uploadingImage ? t("uploading") : loading ? t("addingContact") : t("addContact")}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Contact Modal */}
        <AnimatePresence>
          {showEditModal && (
            <motion.div
              className="modal-overlay fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="modal bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-700"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="modal-header flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">{t("editContact")}</h2>
                  <motion.button
                    className="close-btn text-gray-400 hover:text-white text-3xl leading-none"
                    onClick={() => setShowEditModal(false)}
                    {...buttonHoverTap}
                  >
                    &times;
                  </motion.button>
                </div>

                <form onSubmit={handleEditContact}>
                  <div className="form-group mb-4">
                    <label htmlFor="edit-name" className="block text-gray-300 text-sm font-semibold mb-2">{t("name")} *</label>
                    <input
                      type="text"
                      id="edit-name"
                      name="name"
                      value={editContact.name}
                      onChange={(e) => handleInputChange(e, true)}
                      placeholder={t("contactName")}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="form-group mb-4">
                    <label htmlFor="edit-email" className="block text-gray-300 text-sm font-semibold mb-2">{t("email")}</label>
                    <input
                      type="email"
                      id="edit-email"
                      name="email"
                      value={editContact.email}
                      onChange={(e) => handleInputChange(e, true)}
                      placeholder={t("emailAddress")}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="form-group mb-4">
                    <label htmlFor="edit-phone" className="block text-gray-300 text-sm font-semibold mb-2">{t("phoneNumber")}</label>
                    <input
                      type="tel"
                      id="edit-phone"
                      name="phone"
                      value={editContact.phone}
                      onChange={(e) => handleInputChange(e, true)}
                      placeholder={t("phoneNumber")}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="form-group checkbox-group mb-4 flex items-center">
                    <input
                      type="checkbox"
                      id="edit-isEmergency"
                      name="isEmergency"
                      checked={editContact.isEmergency}
                      onChange={(e) => handleInputChange(e, true)}
                      className="mr-2 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="edit-isEmergency" className="text-gray-300 text-sm font-semibold">{t("emergencyContact")}</label>
                  </div>

                  <div className="form-group mb-6">
                    <label htmlFor="edit-photo" className="block text-gray-300 text-sm font-semibold mb-2">{t("photo")}</label>
                    <input
                      type="file"
                      id="edit-photo"
                      name="photo"
                      onChange={(e) => handleFileChange(e, true)}
                      accept="image/*"
                      className="w-full text-gray-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 transition-all duration-300"
                    />
                    {editContact.photo_url && (
                      <div className="preview-photo mt-4">
                        <img src={editContact.photo_url} alt={t("preview")} className="max-w-[100px] max-h-[100px] rounded-full object-cover mx-auto" />
                      </div>
                    )}
                    <small className="photo-note text-gray-400 text-xs block mt-2">{t("leaveEmptyToKeepCurrentPhoto")}</small>
                  </div>

                  <div className="form-actions flex justify-end space-x-4">
                    <motion.button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      disabled={uploadingImage}
                      className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      {...buttonHoverTap}
                    >
                      {t("cancel")}
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={uploadingImage || loading}
                      {...buttonHoverTap}
                    >
                      {uploadingImage ? t("uploading") : t("saveChanges")}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation Modal */}
        <AnimatePresence>
          {showConversationModal && selectedContact && (
            <motion.div
              className="modal-overlay fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="modal conversation-modal bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg h-[80vh] flex flex-col border border-gray-700"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="modal-header flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
                  <h2 className="text-2xl font-bold text-white">{t("conversationWith")} {selectedContact.name}</h2>
                  <motion.button
                    className="close-btn text-gray-400 hover:text-white text-3xl leading-none"
                    onClick={() => setShowConversationModal(false)}
                    {...buttonHoverTap}
                  >
                    &times;
                  </motion.button>
                </div>

                <div className="conversation-container flex-grow overflow-y-auto pr-2 custom-scrollbar">
                  {selectedContact.conversation_data && selectedContact.conversation_data.length > 0 ? (
                    <div className="conversation-messages space-y-4">
                      {selectedContact.conversation_data.map((message, index) => (
                        <div key={index} className="message p-3 rounded-lg bg-gray-700 text-white shadow-md">
                          <div className="message-text text-base">{message.text}</div>
                          <div className="message-timestamp text-xs text-gray-400 mt-1 text-right">{formatTimestamp(message.timestamp)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-conversation text-center text-gray-400 py-10">{t("noConversationHistory")}</p>
                  )}
                </div>

                <div className="modal-footer mt-6 pt-4 border-t border-gray-700 flex justify-end">
                  <motion.button
                    className="close-modal-btn px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition duration-300"
                    onClick={() => setShowConversationModal(false)}
                    {...buttonHoverTap}
                  >
                    {t("close")}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export default Contacts;