# EchoMind: Alzheimer's Patient Companion App

## Overview
This project is a companion application designed to assist Alzheimer's patients and their caretaker by recording and logging conversations with known persons. The system employs facial recognition to identify individuals and voice recognition to convert speech to text for storing conversation logs. The recorded conversations are stored and displayed for the patient to review later.

## Features
- **Facial Recognition**: Maps faces with stored data for identification.
- **Voice Recognition**: Converts speech to text for logging conversations.
- **Conversation Logging**: Records and stores conversations.
- **REST API**: Backend exposes APIs for interaction.
- **MongoDB Atlas**: Cloud database for storing user and conversation data.
- **React App**: Displays conversation logs for easy review.

## Tech Stack
- **Backend**: Flask (Python)
- **Frontend**: React.js
- **Database**: MongoDB Atlas
- **AI Integration**: Groq API for summarization

## System Workflow
1. The system captures audio and video input.
2. Facial recognition maps the speaker to a known individual.
3. Voice recognition converts speech to text for logging conversations.
4. Conversations are recorded and stored in MongoDB Atlas.
5. The React app fetches and displays stored conversations.

## Setup Instructions
### Backend (Flask API)
1. Clone the repository:
   ```bash
   git clone <repo-link>
   cd backend
   ```
2. Set up a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   pip install -r requirements.txt
   ```
3. Set up environment variables for MongoDB Atlas and Groq API.
4. Run the Flask server:
   ```
   python app.py
   ```

### Frontend (React.js)
1. Navigate to the frontend folder:
   ```bash
   cd my-react-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React app:
   ```bash
   npm start
   ```

### To Start the Capture the Logs
1. Use different device for logs capturing
2. Navigate to Main Repo folder
   ```bash
   python app.py
   ```

## Contributing
Feel free to fork this repository and submit pull requests to contribute.
